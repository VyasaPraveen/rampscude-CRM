/**
 * Human-facing document numbers (orders, payments, services, invoices, leads,
 * quotations).
 *
 * The sequence is derived from the HIGHEST trailing number already issued, never
 * from the list length: deleting a record must not make the next one reuse a
 * number that is already printed on a customer's paperwork.
 */

/** Highest trailing number across the given document numbers (0 when there are none). */
export function maxSequence(existing: string[]): number {
  return existing.reduce((max, value) => {
    const match = /(\d+)\s*$/.exec(value);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

/** Next free sequence number — one past the highest already issued. */
export function nextSequence(existing: string[]): number {
  return maxSequence(existing) + 1;
}

/** Next document number for a prefix, e.g. `RC-ORD-2026-007`. */
export function nextDocNumber(prefix: string, existing: string[], width = 3): string {
  return `${prefix}${String(nextSequence(existing)).padStart(width, "0")}`;
}
