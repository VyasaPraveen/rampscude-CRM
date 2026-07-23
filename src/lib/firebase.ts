import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let cached: { app: FirebaseApp; db: Firestore; auth: Auth } | null = null;

/** Whether the build has Firebase credentials baked in. */
export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * Lazily initialise Firebase on the client. Returns null on the server, when the
 * config is missing, or if initialisation fails — callers then fall back to
 * local-only storage.
 */
export function getFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  if (cached) return cached;
  try {
    const app = getApps()[0] ?? initializeApp(config);
    // Offline cache keeps the CRM usable without a connection and syncs on reconnect.
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    cached = { app, db, auth: getAuth(app) };
    return cached;
  } catch {
    return null;
  }
}

/** Sign in anonymously so Firestore rules can require an authenticated caller. */
export async function ensureSignedIn(): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) return false;
  if (fb.auth.currentUser) return true;
  try {
    await signInAnonymously(fb.auth);
    return true;
  } catch {
    return false;
  }
}
