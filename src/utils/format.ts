export function currency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

/**
 * Today as a local-calendar `YYYY-MM-DD`.
 *
 * `toISOString().slice(0,10)` yields the UTC day, so in IST (UTC+5:30) every
 * moment between 00:00 and 05:29 local time reports the PREVIOUS day — stamping
 * invoices, payments and service calls with yesterday's date. Build the string
 * from the local calendar fields instead, matching the Attendance module.
 */
export function todayIso(): string {
  return isoDay(new Date());
}

/** A given date as a local-calendar `YYYY-MM-DD`. */
export function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A local-calendar `YYYY-MM-DD` `days` from now (negative for the past). */
export function isoDayFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDay(date);
}
