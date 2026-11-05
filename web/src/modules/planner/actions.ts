/**
 * What the planner UI can do: every action is one `undoable` together with the run it causes and its
 * write-backs (`runUser`), and ends in one toast line with the undo (`runToast`). Sources are
 * reached only through the contract (`plannableSource`), never by import.
 */
import { randomId } from '@/core/db/util';
import { formatMinutes } from '@/core/i18n/format';
import { getLang } from '@/core/i18n/lang';
import { plannableSource, type PlannableEntry } from '@/core/modules/contributions';
import { availableManifests } from '@/core/modules/available';
import { addDays } from '@/core/plan/dates';
import { dayName } from '@/core/plan/explain';
import { now, today } from '@/core/time/now';
import { undoEntry } from '@/core/undo';
import { parseCapture } from '@/quickCapture/parser';
import { saveCapture } from '@/quickCapture/targets';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { extractDuePhrase } from './dueWords';
import { dayRepo, itemKeyOf, itemRepo, putRow } from './repo';
import type { PlanDayRow, PlanItemRow } from './schema';
import { PlannerOffError, runUser, type UserRun } from './services';
import { runToast } from './toast';

const toast = (message: string, run?: UserRun) =>
  useUiStore.getState().toast(
    message,
    run?.entry
      ? {
          label: t.ui.undo,
          run: () => {
            void undoEntry(run.entry!.id).then((ok) =>
              useUiStore.getState().toast(ok ? t.ui.undone : t.ui.undoFailed),
            );
          },
        }
      : undefined,
  );

/**
 * Runs `act` as one undoable user action with its run and shows the one toast line. False when the
 * module was switched off meanwhile (a stale page): nothing happened, the toast says so.
 */
export async function act(
  label: string,
  lead: string,
  titles: Record<string, string>,
  fn: () => Promise<void>,
): Promise<boolean> {
  let run: UserRun;
  try {
    run = await runUser(label, fn);
  } catch (e) {
    if (!(e instanceof PlannerOffError)) throw e;
    toast(t.planner.toast.off);
    return false;
  }
  const titleOf = (unitId: string) => {
    const key = unitId.slice(0, unitId.lastIndexOf('#'));
    return titles[key] ?? run.outcome.inputs.titles[key] ?? key;
  };
  toast(runToast(run.outcome.result, titleOf, lead), run);
  return true;
}

const source = (moduleId: string) =>
  plannableSource(availableManifests().find((m) => m.id === moduleId));

/** The item row of a thing, with its stored facts kept. */
async function itemPatch(entry: PlannableEntry, patch: Partial<PlanItemRow>): Promise<void> {
  const key = itemKeyOf(entry.moduleId, entry.id);
  const row = await itemRepo.get(key);
  const data: PlanItemRow = {
    source: { module: entry.moduleId, id: entry.id },
    order: 0,
    ...row,
    ...patch,
  };
  const clean = Object.fromEntries(
    Object.entries(data).filter(
      ([k, v]) =>
        v !== undefined &&
        !['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f'].includes(k),
    ),
  ) as PlanItemRow;
  await putRow(itemRepo, key, clean);
}

/** The one field: a ToDo through the quick-capture target; „bis Do“ or „Frist“ makes the planner item's due hard. */
export async function addFromField(text: string, titles: Record<string, string>): Promise<boolean> {
  // The phrase is German, like the quick-capture parser (CONCEPT §6c); elsewhere the ⋯ action sets a deadline.
  const phrase =
    getLang() === 'de' ? extractDuePhrase(text, today()) : { text, hasDueWord: false as const };
  const parsed = parseCapture(phrase.text, { now: new Date(now()), defaultType: 'todo' });
  const hardDue = phrase.date ?? (phrase.hasDueWord ? parsed.fields.date : undefined);
  // The deadline is the ToDo's date too, so the ToDo page shows it.
  if (hardDue && !parsed.fields.date) parsed.fields.date = hardDue;
  const lead = hardDue ? t.planner.toast.addedWithDue(dayName(hardDue)) : t.planner.toast.added;
  return act(t.planner.toast.added, lead, titles, async () => {
    const saved = await saveCapture('todo', parsed.fields);
    if (hardDue)
      await putRow(itemRepo, itemKeyOf(saved.moduleId, saved.id), {
        source: { module: saved.moduleId, id: saved.id },
        due: { date: hardDue, hard: true },
        order: 0,
      });
  });
}

export const markDone = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.toast.done, t.planner.toast.done, titles, async () => {
    await (await source(e.moduleId))?.onDone?.(e.id);
  });

/** „Später“: the thing's own date becomes tomorrow (an earliest day, never a pin). */
export const later = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.toast.later, t.planner.toast.later, titles, async () => {
    await (await source(e.moduleId))?.onAssign?.(e.id, addDays(today(), 1));
  });

export const pin = (e: PlannableEntry, date: string, titles: Record<string, string>) =>
  act(t.planner.row.pin, t.planner.toast.pinned(dayName(date)), titles, () =>
    itemPatch(e, { pinned: date }),
  );

export const unpin = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.row.unpin, t.planner.toast.unpinned, titles, () =>
    itemPatch(e, { pinned: undefined }),
  );

export const exclude = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.row.exclude, t.planner.toast.excluded, titles, () =>
    itemPatch(e, { excluded: true }),
  );

export const include = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.row.include, t.planner.toast.included, titles, () =>
    itemPatch(e, { excluded: undefined }),
  );

export const markDue = (e: PlannableEntry, date: string, titles: Record<string, string>) =>
  act(t.planner.row.markDue, t.planner.toast.markedDue(dayName(date)), titles, () =>
    itemPatch(e, { due: { date, hard: true } }),
  );

export const unmarkDue = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.row.unmarkDue, t.planner.toast.unmarkedDue, titles, () =>
    itemPatch(e, { due: undefined }),
  );

/** The stored day row of a date with `patch` applied (created when missing). */
async function dayPatch(date: string, patch: Partial<PlanDayRow>): Promise<void> {
  const row = await dayRepo.get(date);
  const data: PlanDayRow = {
    date,
    blockers: row?.blockers ?? [],
    ...(row?.availableMin !== undefined ? { availableMin: row.availableMin } : {}),
    ...(row?.note ? { note: row.note } : {}),
    ...patch,
  };
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as PlanDayRow;
  await putRow(dayRepo, date, clean);
}

export const AVAILABLE_STEP = 30;

export const setAvailable = (date: string, min: number, titles: Record<string, string>) =>
  act(
    t.planner.day.available,
    min === 0
      ? t.planner.toast.dayOff(dayName(date))
      : t.planner.toast.available(dayName(date), formatMinutes(min, { compact: true })),
    titles,
    () => dayPatch(date, { availableMin: Math.max(0, Math.min(1440, min)) }),
  );

/** „Zeit wieder einplanen“: drops the day's own value, the weekday setting applies again. */
export const clearAvailable = (date: string, titles: Record<string, string>) =>
  act(t.planner.day.dayOn, t.planner.toast.dayOn(dayName(date)), titles, () =>
    dayPatch(date, { availableMin: undefined }),
  );

export const addBlocker = (
  date: string,
  label: string,
  min: number,
  titles: Record<string, string>,
) =>
  act(t.planner.day.addBlocker, t.planner.toast.blockerAdded, titles, async () => {
    const row = await dayRepo.get(date);
    await dayPatch(date, { blockers: [...(row?.blockers ?? []), { id: randomId(), label, min }] });
  });

export const removeBlocker = (date: string, id: string, titles: Record<string, string>) =>
  act(t.planner.day.removeBlocker(''), t.planner.toast.blockerRemoved, titles, async () => {
    const row = await dayRepo.get(date);
    await dayPatch(date, { blockers: (row?.blockers ?? []).filter((b) => b.id !== id) });
  });

/** „Woche prüfen“: stores the confirmed minutes of every shown day (only days that differ are written). */
export const confirmWeek = (
  values: { date: string; availableMin: number; current: number }[],
  titles: Record<string, string>,
) =>
  act(t.planner.check.title, t.planner.toast.weekChecked, titles, async () => {
    for (const v of values)
      if (v.availableMin !== v.current) await dayPatch(v.date, { availableMin: v.availableMin });
  });
