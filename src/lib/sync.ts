import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { ensureSignedIn, getFirebase, isFirebaseConfigured } from "@/lib/firebase";
import { saveState } from "@/lib/storage";

/**
 * Cross-device sync.
 *
 * Every module's list is mirrored to a single Firestore document under
 * `workspace/{storageKey}`, holding the collection as a JSON string. Storing JSON
 * (rather than native arrays) sidesteps Firestore's rejection of `undefined`
 * fields and its nested-array restriction, and keeps the existing array-shaped
 * state in the app untouched.
 *
 * Writes are last-write-wins per module: two people editing *different* modules
 * never conflict, but simultaneous edits to the same module resolve to whoever
 * saved last. That is an accepted trade-off for this deployment.
 */

const COLLECTION = "workspace";

/** Firestore caps a document at 1 MiB; stay clear of it and warn before writes fail. */
const MAX_DOC_BYTES = 900_000;

export type SyncStatus = "disabled" | "connecting" | "live" | "error";

type Listener = (status: SyncStatus, detail?: string) => void;

let status: SyncStatus = isFirebaseConfigured() ? "connecting" : "disabled";
const listeners = new Set<Listener>();

function setStatus(next: SyncStatus, detail?: string) {
  status = next;
  listeners.forEach((listener) => listener(next, detail));
}

/** Current connection state. */
export function getSyncStatus(): SyncStatus {
  return status;
}

/** Subscribe to sync status changes (and any error detail worth showing the user). */
export function onSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

/** True when the app can talk to Firestore at all. */
export function isSyncAvailable(): boolean {
  return isFirebaseConfigured() && getFirebase() !== null;
}

/**
 * Subscribe to every synced document. `onDoc` fires with the parsed payload each
 * time a document changes — locally or on another device. Returns an unsubscribe.
 *
 * `onMissing` fires only for a document that genuinely does not exist on the
 * server, so this device can publish its data into a fresh workspace.
 */
export function subscribeWorkspace(
  keys: string[],
  onDoc: (key: string, value: unknown) => void,
  onMissing?: (key: string) => void
): () => void {
  const fb = getFirebase();
  if (!fb) {
    setStatus("disabled");
    return () => {};
  }

  const unsubscribers: (() => void)[] = [];
  let cancelled = false;
  let liveKeys = 0;

  setStatus("connecting");

  void ensureSignedIn().then((ok) => {
    if (cancelled) return;
    if (!ok) {
      // Sign-in failed: the app keeps working locally, but must not claim to be synced.
      setStatus("error", "Could not sign in to the sync service.");
      return;
    }
    keys.forEach((key) => {
      const unsubscribe = onSnapshot(
        doc(fb.db, COLLECTION, key),
        (snapshot) => {
          // Only a server-confirmed snapshot proves the connection is live.
          if (!snapshot.metadata.fromCache) {
            liveKeys += 1;
            if (status !== "live") setStatus("live");
          }
          const raw = snapshot.data()?.json;
          if (typeof raw === "string") {
            try {
              onDoc(key, JSON.parse(raw));
            } catch {
              // Corrupt payload — keep whatever the app already has.
            }
          } else if (!snapshot.exists() && !snapshot.metadata.fromCache) {
            onMissing?.(key);
          }
        },
        (error) => {
          if (liveKeys === 0) setStatus("error", error.message);
        }
      );
      unsubscribers.push(unsubscribe);
    });
  });

  return () => {
    cancelled = true;
    unsubscribers.forEach((fn) => fn());
  };
}

export type PushResult = "ok" | "skipped" | "too-large" | "failed";

/** Push a module's data to Firestore. */
export async function pushDoc(key: string, value: unknown): Promise<PushResult> {
  const fb = getFirebase();
  if (!fb) return "skipped";
  const json = JSON.stringify(value);
  if (json.length > MAX_DOC_BYTES) return "too-large";
  try {
    if (!(await ensureSignedIn())) return "failed";
    await setDoc(doc(fb.db, COLLECTION, key), { json, updatedAt: Date.now() });
    if (status !== "live") setStatus("live");
    return "ok";
  } catch {
    return "failed";
  }
}

export interface PersistResult {
  /** Whether the local cache write succeeded. */
  local: boolean;
  /** Resolves once the cloud write settles. */
  cloud: Promise<PushResult>;
}

/**
 * Save a module's data: writes the local cache immediately (so the UI survives a
 * reload even offline) and mirrors to Firestore. Callers should surface a cloud
 * failure rather than reporting an unqualified success.
 */
export function persist<T>(key: string, value: T): PersistResult {
  const local = saveState(key, value);
  return { local, cloud: pushDoc(key, value) };
}
