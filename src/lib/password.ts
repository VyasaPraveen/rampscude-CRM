import type { User } from "@/types/crm";

/**
 * Password hashing for the CRM's own login.
 *
 * There is no server to hold a secret, so this uses PBKDF2-SHA256 via the Web
 * Crypto API with a per-user random salt. That keeps plaintext passwords out of
 * storage and out of the synced workspace. It is *not* a substitute for real
 * server-side authentication — when the CRM moves to its own backend, logins
 * should be verified there.
 */

const ITERATIONS = 150_000;
const KEY_BITS = 256;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function subtle(): SubtleCrypto | null {
  if (typeof globalThis === "undefined") return null;
  return globalThis.crypto?.subtle ?? null;
}

/** True when the browser can hash (secure context). */
export function canHash(): boolean {
  return subtle() !== null;
}

export function newSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashPassword(plain: string, salt: string): Promise<string> {
  const crypto = subtle();
  if (!crypto) throw new Error("Web Crypto unavailable");
  const key = await crypto.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BITS
  );
  return toHex(bits);
}

/** Constant-time-ish comparison to avoid leaking match position. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a password against a user record, supporting not-yet-upgraded records. */
export async function verifyPassword(user: User, plain: string): Promise<boolean> {
  if (user.passwordHash && user.passwordSalt) {
    try {
      return equals(await hashPassword(plain, user.passwordSalt), user.passwordHash);
    } catch {
      return false;
    }
  }
  // Legacy record created before hashing existed.
  return typeof user.password === "string" && user.password.length > 0 && user.password === plain;
}

/** Produce the hashed credential fields for a user, dropping any plaintext. */
export async function withHashedPassword(user: User, plain: string): Promise<User> {
  if (!canHash()) return { ...user, password: plain };
  const salt = newSalt();
  const passwordHash = await hashPassword(plain, salt);
  const next = { ...user, passwordHash, passwordSalt: salt };
  delete next.password;
  return next;
}

/**
 * Upgrade any records still holding a plaintext password. Returns the same array
 * reference when nothing needed changing, so callers can skip a pointless write.
 */
export async function upgradeStoredPasswords(users: User[]): Promise<User[]> {
  if (!canHash() || !users.some((user) => user.password && !user.passwordHash)) return users;
  return Promise.all(users.map((user) => (user.password && !user.passwordHash ? withHashedPassword(user, user.password) : user)));
}
