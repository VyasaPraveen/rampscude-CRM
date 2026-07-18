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
  payments: "rc_payments"
} as const;

export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked — in-memory state still holds.
  }
}
