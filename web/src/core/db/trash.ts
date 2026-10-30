/**
 * "Zuletzt gelöscht": a deleted record stays a tombstone (`deletedAt`) and can be restored for this
 * long. Read-only helpers; nothing here writes. Data that lives next to a record (the files of
 * Unterlagen) is kept while the record is inside the window.
 */
export const TRASH_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

/** True while a deleted record can still be restored. */
export const isRestorable = (deletedAt: number | null | undefined, at: number): boolean =>
  typeof deletedAt === 'number' && at - deletedAt < TRASH_RETENTION_MS;

/** Active, or deleted so recently that it can come back (what must not lose its extras). */
export const isLiveOrRestorable = (deletedAt: number | null | undefined, at: number): boolean =>
  deletedAt === null || deletedAt === undefined || isRestorable(deletedAt, at);
