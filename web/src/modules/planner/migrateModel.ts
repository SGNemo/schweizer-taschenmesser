/**
 * The one-time step into „the plan stays put“ (docs/design/planner-rethink/CONCEPT-MIGRATION.md §2). Until then a
 * thing was nailed to a day by `item.pinned`; now „fest“ is a flag on the placement row itself, so day and lock
 * cannot disagree. The step is keyed on the data (a pin that is still stored), so a restored old backup or a pin a
 * device on the old version writes later is taken over the same way; two devices that both run it write the same
 * field values.
 *
 *  - pin = the date of one of the thing's rows → that row is „fest“;
 *  - pin today or later, no row there (it lay beyond the horizon, or the thing waited) → the thing lies on the
 *    pinned day (all its parts), „fest“ – a day the person fixed explicitly; the old engine only ignored it while
 *    it was far away; a thing set to „Nicht planen“ gets no row;
 *  - pin before today, row elsewhere → the row stays where the person sees it, not „fest“;
 *  - the pin is cleared in every case.
 *
 * No other row is touched. `autoReplan` is stored as off where the install syncs: the new planner never reads it,
 * but a device that is still on the old version stops its background runs with it.
 */
import { getMeta, setMeta } from '@/core/db/metaKv';
import { DEFAULT_MIN } from '@/core/plan/types';
import { unitId } from '@/core/plan/units';
import { setSettings } from '@/core/settings/settings';
import { loadSyncConfig } from '@/core/sync/service';
import { getPlannerSettings } from './prefs';
import { plannerRepos, putRow, type PlannerDb } from './repo';
import type { AssignmentRow, PlanItemRow } from './schema';
import { DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from './settings';

/** Device-local: this device has made the step. */
export const MODEL_KEY = 'planner.model';
export const MODEL = 2;

const ENVELOPE = ['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f'];
const plain = <T extends object>(row: T): T =>
  Object.fromEntries(
    Object.entries(row).filter(([k, v]) => v !== undefined && !ENVELOPE.includes(k)),
  ) as T;

/** Pins → locks. Returns the number of rows written (0 on a second pass). */
export async function migratePins(
  today: string,
  database?: PlannerDb,
  /** Filled with the item keys whose rows moved to their pinned day: their source has to hear the new day. */
  moved: string[] = [],
  /** Narrows the step to some things (the seed: only its own). */
  only?: (itemKey: string) => boolean,
): Promise<number> {
  const repos = plannerRepos(database);
  const items = (await repos.item.active().toArray()).filter(
    (i) => i.pinned && (!only || only(i.id)),
  );
  if (items.length === 0) return 0;
  const rows = (await repos.assignment.active().toArray()) as (AssignmentRow & { id: string })[];
  let n = 0;
  for (const item of items) {
    const pinned = item.pinned!;
    const own = rows.filter((r) => r.itemKey === item.id).sort((a, b) => a.k - b.k);
    const there = own.filter((r) => r.date === pinned);
    if (there.length > 0) {
      for (const r of there)
        if (await putRow(repos.assignment, r.id, { ...plain(r), locked: true })) n++;
    } else if (pinned >= today && own.length > 0) {
      // The pin held the whole thing: every part goes to the pinned day (as a move by hand does).
      for (const r of own)
        if (await putRow(repos.assignment, r.id, { ...plain(r), date: pinned, locked: true })) n++;
      moved.push(item.id);
    } else if (pinned >= today && !item.excluded) {
      const data: AssignmentRow = {
        itemKey: item.id,
        k: 0,
        of: 1,
        date: pinned,
        minutes: item.durationMin ?? DEFAULT_MIN,
        order: 0,
        reason: 'pinned',
        locked: true,
      };
      if (await putRow(repos.assignment, unitId(item.id, 0), data)) n++;
      moved.push(item.id);
    }
    const { pinned: _gone, ...rest } = plain(item as PlanItemRow);
    void _gone;
    if (await putRow(repos.item, item.id, rest)) n++;
  }
  return n;
}

/** The whole step, as the service runs it once the sync has settled. */
export async function migrateModel(today: string): Promise<string[]> {
  const moved: string[] = [];
  await migratePins(today, undefined, moved);
  // `autoReplan` off, for the sake of a device that is still on the old version: only an install that syncs has
  // such a device, so an app without a sync writes nothing (and nothing reaches its outbox). Checked at every
  // start – a sync that is set up later gets the value then; once stored as off, nothing is written again.
  if ((await loadSyncConfig()) && (await getPlannerSettings()).autoReplan !== false)
    await setSettings(PLANNER_SCOPE, { autoReplan: false }, DEFAULT_PLANNER_SETTINGS);
  if ((await getMeta<number>(MODEL_KEY)) !== MODEL) await setMeta(MODEL_KEY, MODEL);
  return moved;
}
