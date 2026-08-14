import { APP_VERSION } from "@/lib/version";
import { STORAGE_KEYS, loadState, saveState } from "@/lib/storage";

/**
 * Local backup of the whole workspace.
 *
 * Every module is bundled into one JSON document the admin can download (a manual
 * off-device copy) and later restore. A lightweight snapshot is also written to
 * local storage once a day, so there is always a same-day local copy even if no
 * file was downloaded; if that daily snapshot cannot be written, the app nags the
 * admin to take a manual backup.
 */

/** Module keys included in a backup (everything except the session and bookkeeping keys). */
const BACKUP_KEYS = [
  STORAGE_KEYS.customers,
  STORAGE_KEYS.quotations,
  STORAGE_KEYS.inventory,
  STORAGE_KEYS.leads,
  STORAGE_KEYS.invoices,
  STORAGE_KEYS.orders,
  STORAGE_KEYS.services,
  STORAGE_KEYS.payments,
  STORAGE_KEYS.brands,
  STORAGE_KEYS.users,
  STORAGE_KEYS.attendance,
  STORAGE_KEYS.settings,
  STORAGE_KEYS.license
] as const;

export interface BackupDocument {
  app: string;
  version: string;
  exportedAt: string;
  modules: Record<string, unknown>;
}

/** Today's calendar day (YYYY-MM-DD), used to know whether a backup ran today. */
export function backupDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build a backup document from the given per-module data. */
export function buildBackup(data: Record<string, unknown>): BackupDocument {
  const modules: Record<string, unknown> = {};
  BACKUP_KEYS.forEach((key) => {
    if (key in data) modules[key] = data[key];
  });
  return { app: "Ramps Cube CRM", version: APP_VERSION, exportedAt: new Date().toISOString(), modules };
}

/** Trigger a client-side download of the backup document. */
export function downloadBackup(data: Record<string, unknown>): string {
  const doc = buildBackup(data);
  const filename = `ramps-cube-backup-${backupDayKey()}.json`;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}

/**
 * Write today's automatic local snapshot if one has not been written yet today.
 * Returns "done" if a snapshot exists for today (already or just written),
 * or "failed" when local storage could not be written (quota / private mode).
 */
export function ensureDailyLocalBackup(data: Record<string, unknown>): "done" | "failed" {
  const today = backupDayKey();
  if (loadState<string>(STORAGE_KEYS.lastBackup, "") === today) return "done";
  const okSnapshot = saveState("rc_backup_snapshot", buildBackup(data));
  const okStamp = saveState(STORAGE_KEYS.lastBackup, today);
  return okSnapshot && okStamp ? "done" : "failed";
}

/** The day of the most recent automatic local snapshot (or "" if none). */
export function lastBackupDay(): string {
  return loadState<string>(STORAGE_KEYS.lastBackup, "");
}

const MANUAL_BACKUP_KEY = "rc_manual_backup";

/** The day of the most recent manual (downloaded) backup, or "". */
export function lastManualBackupDay(): string {
  return loadState<string>(MANUAL_BACKUP_KEY, "");
}

/** Record that a manual backup file was downloaded today. */
export function markManualBackupToday(): void {
  saveState(MANUAL_BACKUP_KEY, backupDayKey());
}

/** Parse and validate an uploaded backup file. Returns its modules, or null. */
export function parseBackup(text: string): Record<string, unknown> | null {
  try {
    const doc = JSON.parse(text) as Partial<BackupDocument>;
    if (!doc || typeof doc !== "object" || !doc.modules || typeof doc.modules !== "object") return null;
    return doc.modules as Record<string, unknown>;
  } catch {
    return null;
  }
}
