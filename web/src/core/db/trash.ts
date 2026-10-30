/**
 * "Zuletzt gelöscht": a deleted record stays a tombstone (`deletedAt`) and can be restored for this
 * long. Read-only helpers; nothing here writes. Data that lives next to a record (the files of
 * Unterlagen) is kept while the record is inside the window. The window is 30 days; with the switch
 * "Zuletzt gelöscht aufbewahren" off it shrinks to a short grace period so "Rückgängig" still works.
 */
export const TRASH_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;
/** Window when the switch is off: long enough for the "Rückgängig" toast and a slow clean-up. */
export const TRASH_GRACE_MS = 10 * 60 * 1000;

/** True while a deleted record can still be restored. */
export const isRestorable = (
  deletedAt: number | null | undefined,
  at: number,
  retentionMs: number = TRASH_RETENTION_MS,
): boolean => typeof deletedAt === 'number' && at - deletedAt < retentionMs;

/** Active, or deleted so recently that it can come back (what must not lose its extras). */
export const isLiveOrRestorable = (
  deletedAt: number | null | undefined,
  at: number,
  retentionMs: number = TRASH_RETENTION_MS,
): boolean =>
  deletedAt === null || deletedAt === undefined || isRestorable(deletedAt, at, retentionMs);
