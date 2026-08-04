/**
 * Thin, safe localStorage wrappers. All demo data lives client-side, so every
 * access is guarded for SSR (static export prerender) and blocked storage
 * (private mode / quota) and falls back gracefully.
 */

export const STORAGE_KEYS = {
  auth: "rc_session",
  customers: "rc_customers",
  quotations: "rc_quotations",
  users: "rc_users",
  attendance: "rc_attendance",
  inventory: "rc_inventory",
  leads: "rc_leads",
  invoices: "rc_invoices",
  orders: "rc_orders",
  services: "rc_services",
  payments: "rc_payments",
  brands: "rc_brands",
  settings: "rc_settings",
  dataVersion: "rc_data_version"
} as const;

/**
 * Bump this whenever stored client data must be discarded (e.g. seed data removed).
 * On mismatch every `rc_*` key is cleared, so returning browsers start clean instead
 * of restoring data from a previous build.
 */
export const DATA_VERSION = "2026-08-04-v2";

export function ensureDataVersion(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(STORAGE_KEYS.dataVersion) === DATA_VERSION) return;
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.removeItem("rc_demo_start");
    window.localStorage.setItem(STORAGE_KEYS.dataVersion, DATA_VERSION);
  } catch {
    // Storage blocked — nothing persisted to reset.
  }
}

export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Persist a value. Returns false when storage is blocked or the quota is exceeded,
 *  so callers can tell the user their change was not written to disk. */
export function saveState<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded or storage blocked — in-memory state still holds.
    return false;
  }
}
