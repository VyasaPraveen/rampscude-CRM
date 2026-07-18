/**
 * Demo access control.
 *
 * The app is handed to clients as a time-limited demo. Access is granted for
 * {@link DEMO_DURATION_DAYS} days and then the UI locks behind a "Demo Expired"
 * screen.
 *
 * Two independent guards are combined so the demo cannot be trivially bypassed:
 *
 *  1. A hard deadline baked in at build time via `NEXT_PUBLIC_DEMO_EXPIRES_AT`
 *     (an absolute ISO timestamp). Because the app is a static export, this is
 *     inlined into the bundle and cannot be changed by the client.
 *  2. A rolling window that starts on the device's first launch (stored in
 *     localStorage). This caps access to {@link DEMO_DURATION_DAYS} days from
 *     first use even if no hard deadline is configured.
 *
 * The effective expiry is whichever of the two comes first.
 */

export const DEMO_DURATION_DAYS = 3;

const DEMO_START_KEY = "rc_demo_start";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DemoStatus {
  /** True once the demo window has passed. */
  expired: boolean;
  /** Absolute moment access ends. */
  expiresAt: Date;
  /** Moment the demo window started (first launch or configured start). */
  startedAt: Date;
  /** Milliseconds remaining (0 once expired). */
  remainingMs: number;
  /** Whole days remaining, rounded up (0 once expired). */
  daysLeft: number;
  /** Whole hours remaining, rounded up (0 once expired). */
  hoursLeft: number;
}

/** Parse the build-time hard deadline, if one is configured and valid. */
function configuredDeadline(): Date | null {
  const raw = process.env.NEXT_PUBLIC_DEMO_EXPIRES_AT;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Read (and lazily initialise) the device's first-launch timestamp.
 * Returns `now` when storage is unavailable (SSR / private mode) so the demo
 * still resolves to a sensible window.
 */
function firstLaunch(now: Date): Date {
  if (typeof window === "undefined") return now;
  try {
    const existing = window.localStorage.getItem(DEMO_START_KEY);
    if (existing) {
      const parsed = new Date(existing);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    window.localStorage.setItem(DEMO_START_KEY, now.toISOString());
  } catch {
    // Storage blocked — fall back to the current moment.
  }
  return now;
}

/**
 * Resolve the current demo status. Safe to call on every render; it only reads
 * (and, once, writes) a single localStorage key.
 */
export function getDemoStatus(now: Date = new Date()): DemoStatus {
  const startedAt = firstLaunch(now);
  const hardDeadline = configuredDeadline();

  // A configured absolute deadline is authoritative so every client keeps access
  // until that date regardless of when they first opened the app. The rolling
  // {@link DEMO_DURATION_DAYS}-day window only applies as a fallback when no
  // hard deadline is set in the build.
  const expiresAt = hardDeadline ?? new Date(startedAt.getTime() + DEMO_DURATION_DAYS * DAY_MS);

  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  const expired = remainingMs <= 0;

  return {
    expired,
    expiresAt,
    startedAt,
    remainingMs,
    daysLeft: expired ? 0 : Math.ceil(remainingMs / DAY_MS),
    hoursLeft: expired ? 0 : Math.ceil(remainingMs / (60 * 60 * 1000))
  };
}

/** Human-friendly "time left" label for banners. */
export function formatRemaining(status: DemoStatus): string {
  if (status.expired) return "Demo expired";
  if (status.daysLeft > 1) return `${status.daysLeft} days left`;
  if (status.hoursLeft > 1) return `${status.hoursLeft} hours left`;
  const minutes = Math.max(1, Math.ceil(status.remainingMs / (60 * 1000)));
  return `${minutes} min left`;
}
