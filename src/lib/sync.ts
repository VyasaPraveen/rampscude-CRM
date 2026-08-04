import { saveState } from "@/lib/storage";

/**
 * Cross-device sync — self-hosted.
 *
 * Every module's list is mirrored to a single row in the `crm_workspace` table
 * on the application's own server, holding the collection as a JSON string. A
 * small PHP endpoint (`/api.php`) reads and upserts those rows; this module is
 * the browser-side client for it.
 *
 * There is no realtime push channel, so remote changes are picked up by polling
 * the endpoint every {@link POLL_INTERVAL_MS}. A change made on one device is
 * therefore visible on another within that window.
 *
 * Writes are last-write-wins per module: two people editing *different* modules
 * never conflict, but simultaneous edits to the same module resolve to whoever
 * saved last. That is an accepted trade-off for this deployment.
 */

/** Endpoint that serves and stores the workspace. Same-origin by default. */
const API_URL = process.env.NEXT_PUBLIC_SYNC_API_URL || "/api.php";
/** Shared bearer token the endpoint requires. Sync is disabled without it. */
const API_TOKEN = process.env.NEXT_PUBLIC_SYNC_TOKEN || "";

/** How often to poll the server for changes made on other devices. */
const POLL_INTERVAL_MS = 8_000;

/**
 * How far to rewind the "changed since" marker on each poll. The server reports a
 * single `now` timestamp, but a write can land between the moment the query runs
 * and the moment `now` is read — advancing the marker past a change we never saw
 * would drop it forever. Re-querying a small overlapping window each poll closes
 * that race; re-emitting an already-seen module is harmless (it re-applies the
 * same data). Also absorbs minor clock skew between the app server and clients.
 */
const POLL_OVERLAP_MS = 20_000;

/** Guard against an accidentally huge module blowing up the request. */
const MAX_DOC_BYTES = 4_000_000;

export type SyncStatus = "disabled" | "connecting" | "live" | "error";

type Listener = (status: SyncStatus, detail?: string) => void;

/** Whether the build has a sync endpoint token baked in. */
function isSyncConfigured(): boolean {
  return Boolean(API_TOKEN);
}

let status: SyncStatus = isSyncConfigured() ? "connecting" : "disabled";
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

/** True when the app can talk to the sync server at all. */
export function isSyncAvailable(): boolean {
  return typeof window !== "undefined" && isSyncConfigured();
}

interface WorkspaceResponse {
  now: number;
  modules: Record<string, { payload: string; updatedAt: number }>;
}

/** Fetch modules changed since `since` (0 fetches everything). */
async function fetchWorkspace(since: number): Promise<WorkspaceResponse> {
  const res = await fetch(`${API_URL}?since=${since}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`sync GET ${res.status}`);
  return (await res.json()) as WorkspaceResponse;
}

/**
 * Subscribe to every synced document. `onDoc` fires with the parsed payload for
 * each module that changes — on load and whenever a poll finds a newer version
 * (edited here or on another device). Returns an unsubscribe.
 *
 * `onMissing` fires once, at startup, for any requested key the server has no
 * row for — so this device can publish its data into a fresh workspace.
 */
export function subscribeWorkspace(
  keys: string[],
  onDoc: (key: string, value: unknown) => void,
  onMissing?: (key: string) => void
): () => void {
  if (!isSyncAvailable()) {
    setStatus("disabled");
    return () => {};
  }

  let cancelled = false;
  let lastNow = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = (key: string, payload: string) => {
    try {
      onDoc(key, JSON.parse(payload));
    } catch {
      // Corrupt payload — keep whatever the app already has.
    }
  };

  setStatus("connecting");

  const poll = async (initial: boolean) => {
    if (cancelled) return;
    try {
      const data = await fetchWorkspace(initial ? 0 : lastNow);
      if (cancelled) return;
      // Rewind the marker slightly so the next poll re-checks an overlapping
      // window and can never step over a write it hasn't observed yet.
      lastNow = Math.max(0, (data.now ?? lastNow) - POLL_OVERLAP_MS);

      if (initial) {
        keys.forEach((key) => {
          const mod = data.modules[key];
          if (mod) emit(key, mod.payload);
          else onMissing?.(key);
        });
      } else {
        Object.entries(data.modules).forEach(([key, mod]) => emit(key, mod.payload));
      }
      if (status !== "live") setStatus("live");
    } catch (error) {
      if (!cancelled) setStatus("error", error instanceof Error ? error.message : "Sync unavailable.");
    } finally {
      if (!cancelled) timer = setTimeout(() => void poll(false), POLL_INTERVAL_MS);
    }
  };

  void poll(true);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

export type PushResult = "ok" | "skipped" | "too-large" | "failed";

/** Push a module's data to the server. */
export async function pushDoc(key: string, value: unknown): Promise<PushResult> {
  if (!isSyncAvailable()) return "skipped";
  const payload = JSON.stringify(value);
  if (payload.length > MAX_DOC_BYTES) return "too-large";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, payload }),
      cache: "no-store"
    });
    if (!res.ok) return "failed";
    if (status !== "live") setStatus("live");
    return "ok";
  } catch {
    return "failed";
  }
}

export interface PersistResult {
  /** Whether the local cache write succeeded. */
  local: boolean;
  /** Resolves once the server write settles. */
  cloud: Promise<PushResult>;
}

/**
 * Save a module's data: writes the local cache immediately (so the UI survives a
 * reload even offline) and mirrors to the server. Callers should surface a
 * server failure rather than reporting an unqualified success.
 */
export function persist<T>(key: string, value: T): PersistResult {
  const local = saveState(key, value);
  return { local, cloud: pushDoc(key, value) };
}
