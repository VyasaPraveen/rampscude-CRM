import type { LicenseRecord } from "@/types/crm";

/**
 * Offline yearly-licence signing for the CRM.
 *
 * There is no licence server, so keys are signed with a secret baked into the
 * build (visible in the bundle, like the sync token). This deters casual
 * tampering and lets the app enforce the term end date carried inside the key.
 * A key is issued by the vendor for a fixed term; renewal is simply a new key
 * with a later end date. Strong per-install binding would need a licence server.
 */
const LICENSE_SECRET = "RampsCube-CRM-Licence-2026-v1";

export type LicenseStatus = "checking" | "active" | "renew-soon" | "expired" | "unlicensed" | "invalid";

/** Days before the term end that the renewal notice begins. */
export const RENEWAL_WINDOW_DAYS = 30;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Parse YYYYMMDD → local-midnight Date, or null. */
export function parseYmd(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** YYYYMMDD → YYYY-MM-DD for display/storage. */
export function ymdToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Short signature for a from/until (YYYYMMDD) pair. */
export async function licenseSignature(from: string, until: string): Promise<string> {
  const hex = await sha256Hex(`${from}|${until}|${LICENSE_SECRET}`);
  return hex.slice(0, 8).toUpperCase();
}

/** Compose a full key string (used by the vendor key generator). */
export async function makeLicenseKey(from: string, until: string): Promise<string> {
  return `RCUBE-${from}-${until}-${await licenseSignature(from, until)}`;
}

interface ParsedKey {
  from: string;
  until: string;
  sig: string;
}

function parseLicenseKey(key: string): ParsedKey | null {
  const match = /^RCUBE-(\d{8})-(\d{8})-([0-9A-F]{8})$/.exec(key.trim().toUpperCase());
  return match ? { from: match[1], until: match[2], sig: match[3] } : null;
}

/** Verify a raw key: signature must match and the dates must parse. */
export async function verifyLicenseKey(key: string): Promise<{ from: string; until: string } | null> {
  const parsed = parseLicenseKey(key);
  if (!parsed) return null;
  const expected = await licenseSignature(parsed.from, parsed.until);
  if (expected !== parsed.sig) return null;
  if (!parseYmd(parsed.from) || !parseYmd(parsed.until)) return null;
  return { from: parsed.from, until: parsed.until };
}

/** Inclusive end-of-day epoch (ms) for a YYYYMMDD, or null. */
function endOfDayMs(value: string): number | null {
  const date = parseYmd(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

/** Build the stored record from a verified key. */
export function licenseRecordFromKey(key: string, from: string, until: string, activatedAt: string): LicenseRecord {
  return { key: key.trim().toUpperCase(), validFrom: ymdToIso(from), validUntil: ymdToIso(until), activatedAt };
}

/** The end-of-term epoch for a stored record (from its verified key), or null. */
export async function licenseUntilMs(record: LicenseRecord): Promise<number | null> {
  const verified = await verifyLicenseKey(record.key);
  return verified ? endOfDayMs(verified.until) : null;
}

/** Evaluate a stored record against `now` (ms). Re-verifies the key's signature. */
export async function evaluateLicense(record: LicenseRecord | null, now: number): Promise<LicenseStatus> {
  if (!record?.key) return "unlicensed";
  const verified = await verifyLicenseKey(record.key);
  if (!verified) return "invalid";
  const until = endOfDayMs(verified.until);
  if (until === null) return "invalid";
  if (now > until) return "expired";
  if (now > until - RENEWAL_WINDOW_DAYS * 86_400_000) return "renew-soon";
  return "active";
}
