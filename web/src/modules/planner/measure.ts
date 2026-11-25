/**
 * Measured duration (planner hub 2, package 8; CONCEPT-ROWS idea 8, hand-off 08). A focus round or a „Los“ step that ends
 * with „Erledigt“ / „Fertig · weiter“ records the minutes that ran (pauses removed; < 1 min and > 8 h not) – inside the
 * action that ends it, so its undo takes the record back too. A **new** thing without minutes whose key has ≥ 2 records
 * starts with the median of the last five, rounded to 5; nothing that exists ever changes its minutes.
 *
 * „The same thing“: the source's stable id for a thing that comes back (`entityId`, e.g. a routine), else the title as
 * „Plan einfügen“ compares it (`sameTitle`). No fuzzy match: a near miss gets 30 as today.
 */
import { notDeleted } from '@/core/db/repo';
import type { Stored } from '@/core/db/types';
import type { FocusSession } from '@/core/focus/session';
import type { PlannableEntry } from '@/core/modules/contributions';
import { today } from '@/core/time/now';
import { sameTitle } from './pastePlan';
import { getPlannerSettings } from './prefs';
import { measureRepo } from './repo';
import { MEASURE_KEY_MAX, MEASURE_MAX_MIN, type MeasureRow } from './schema';

/** Records kept per key (pruned inside the recording action). */
export const RECORDS_KEPT = 5;
/** Records a key needs before it proposes. */
export const RECORDS_TO_PROPOSE = 2;

/** The key of a title (a new thing, a „Los“ step): its words as „Plan einfügen“ compares them. */
export function titleKey(title: string): string | undefined {
  const words = sameTitle(title);
  return words ? capped(`t:${words}`) : undefined;
}

/** A key fits the record (`measureSchema.key`): a very long title is compared by its first 240 characters. */
const capped = (key: string): string => {
  if (key.length <= MEASURE_KEY_MAX) return key;
  // By whole characters, so an emoji is never cut in half.
  let out = '';
  for (const ch of key) {
    if (out.length + ch.length > MEASURE_KEY_MAX) break;
    out += ch;
  }
  return out;
};

/** The key of a planned thing: its source's stable id when it has one that comes back, else its title. */
export function measureKey(
  e: Pick<PlannableEntry, 'moduleId' | 'title' | 'entityId'>,
): string | undefined {
  return e.entityId ? capped(`id:${e.moduleId}:${e.entityId}`) : titleKey(e.title);
}

/**
 * Minutes (unrounded) a focus round ran until `at`: its clock stops while paused, so pauses are already out; overtime
 * counts.
 */
export function workedMinutes(s: FocusSession, at: number): number {
  const ranMs = s.endAt === undefined ? s.durationMs - s.leftMs : s.durationMs - (s.endAt - at);
  return ranMs / 60_000;
}

/** A record worth keeping: at least a minute, at most eight hours (a timer left running teaches nothing). */
export const recordable = (minutes: number): boolean =>
  Number.isFinite(minutes) && minutes >= 1 && minutes <= MEASURE_MAX_MIN;

/** A key's records, newest first. */
export async function recordsOf(key: string): Promise<Stored<MeasureRow>[]> {
  const rows = await measureRepo.table.where('key').equals(key).filter(notDeleted).toArray();
  // Newest first; a tie in the same millisecond (a fixed clock, a synced pair) by the later write.
  return rows.sort(
    (a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt || b.id.localeCompare(a.id),
  );
}

/**
 * Records `minutes` for `key` and prunes the key to its last five – call it inside the action that ends the round, so
 * one undo takes both back. Nothing while the switch is off or the minutes are out of range.
 */
export async function recordMeasure(key: string | undefined, minutes: number): Promise<void> {
  // The range on what ran (59 s is under a minute), the record in whole minutes.
  if (!key || !recordable(minutes)) return;
  const min = Math.round(minutes);
  if (!(await getPlannerSettings()).measurePropose) return;
  await measureRepo.create({ key, minutes: min, on: today() });
  const older = (await recordsOf(key)).slice(RECORDS_KEPT);
  if (older.length) await measureRepo.removeMany(older.map((r) => r.id));
}

/** The median of the last five records, rounded to 5 (at least 5); none below two records. */
export function proposalOf(minutesNewestFirst: readonly number[]): number | undefined {
  const last = minutesNewestFirst.slice(0, RECORDS_KEPT);
  if (last.length < RECORDS_TO_PROPOSE) return undefined;
  const sorted = [...last].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.max(5, Math.round(median / 5) * 5);
}

/** What a new thing called `title` starts with, if anything (the switch on, ≥ 2 records). */
export async function proposedMinutes(title: string): Promise<number | undefined> {
  const key = titleKey(title);
  if (!key || !(await getPlannerSettings()).measurePropose) return undefined;
  return proposalOf((await recordsOf(key)).map((r) => r.minutes));
}

/** „Gemessene Zeiten löschen“: every record, as one write the caller's action can take back. */
export async function deleteMeasures(): Promise<number> {
  const ids = (await measureRepo.active().primaryKeys()) as string[];
  if (ids.length) await measureRepo.removeMany(ids);
  return ids.length;
}
