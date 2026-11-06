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
import { spanMin, windowText, type TimeWindow } from '@/core/plan/windows';
import { now, today } from '@/core/time/now';
import { undoEntry } from '@/core/undo';
import type { EventMap } from '@/core/events/events';
import { parseCapture, type CaptureFields } from '@/quickCapture/parser';
import { saveCapture, type SavedCapture } from '@/quickCapture/targets';
import type { PlanOp } from '@/core/plan/instructions';
import { setSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { extractDuePhrase } from './dueWords';
import { dayRepo, itemKeyOf, itemRepo, putRow } from './repo';
import type { PlanDayRow, PlanItemRow } from './schema';
import { overloadLine } from './overload';
import { getPlannerSettings } from './prefs';
import { PlannerOffError, runUser, type UserRun } from './services';
import { DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from './settings';
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
  opts: { reshuffle?: boolean; leadOnly?: boolean } = {},
): Promise<boolean> {
  let run: UserRun;
  try {
    run = await runUser(label, fn, opts);
  } catch (e) {
    if (!(e instanceof PlannerOffError)) throw e;
    toast(t.planner.toast.off);
    return false;
  }
  const titleOf = (unitId: string) => {
    const key = unitId.slice(0, unitId.lastIndexOf('#'));
    return titles[key] ?? run.outcome.inputs.titles[key] ?? key;
  };
  // `leadOnly`: one calm sentence (a template); the board shows where things went.
  const line = opts.leadOnly ? lead : runToast(run.outcome.result, titleOf, lead);
  toast(withOverload(line, await overloadNotice(run)), run);
  return true;
}

/**
 * The overload line after a user run (`overload.ts`): only when the overflow went from 0 to above 0, once
 * per ISO week, with `overloadToast` on. It is the second line of the run's one toast (the toast keeps one
 * message, so a toast of its own would push the undo away).
 */
async function overloadNotice(run: UserRun): Promise<string | undefined> {
  const settings = await getPlannerSettings();
  return overloadLine({
    enabled: settings.overloadToast,
    prevMin: run.outcome.prevOverflowMin,
    nextMin: run.outcome.result?.overflowMin,
    today: today(),
  });
}

/** The run's line plus the overload line below it (the toast keeps line breaks). */
export const withOverload = (line: string, overload: string | undefined): string =>
  overload ? `${line}\n${overload}` : line;

/** A title in a toast line stays short (the line keeps under `TOAST_MAX`). */
const short = (title: string, max = 32) =>
  title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;

/**
 * `plan.requested` (a note's „In den Plan“): a ToDo through the quick-capture target `plan` (with the
 * link back), its planner item (a hard due when asked) and the run, as one undoable action; the toast says
 * on which day it landed: „Im Plan: Vermieter antworten · Di · Rückgängig“.
 */
export async function addRequested(req: EventMap['plan.requested']): Promise<boolean> {
  const title = req.title.trim();
  if (!title) return false;
  const fields: CaptureFields = {
    title,
    ...(req.durationMin && req.durationMin > 0 ? { estimateMin: Math.round(req.durationMin) } : {}),
    ...(req.priority ? { priority: req.priority } : {}),
    ...(req.due ? { date: req.due.date, hardDue: req.due.hard } : {}),
    ...(req.link ? { link: req.link } : {}),
  };
  let saved: SavedCapture | undefined;
  let run: UserRun;
  try {
    run = await runUser(t.planner.toast.added, async () => {
      saved = await saveCapture('plan', fields);
    });
  } catch (e) {
    if (!(e instanceof PlannerOffError)) throw e;
    toast(t.planner.toast.off);
    return false;
  }
  const key = saved ? itemKeyOf(saved.moduleId, saved.id) : undefined;
  const first = run.outcome.result?.assignments
    .filter((a) => a.itemKey === key)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const line = first
    ? t.planner.toast.requested(short(title), dayName(first.date))
    : t.planner.toast.requestedWaits(short(title));
  toast(withOverload(line, await overloadNotice(run)), run);
  return true;
}

/** Which sources take a tick or „Später“ back (an invoice or a cancellation does not: that stays in its module). */
export async function sourceAbilities(): Promise<
  Record<string, { done: boolean; assign: boolean }>
> {
  const out: Record<string, { done: boolean; assign: boolean }> = {};
  await Promise.all(
    availableManifests().map(async (m) => {
      const s = await plannableSource(m).catch(() => undefined);
      if (s) out[m.id] = { done: !!s.onDone, assign: !!s.onAssign };
    }),
  );
  return out;
}

const source = (moduleId: string) =>
  plannableSource(availableManifests().find((m) => m.id === moduleId));

/** The item row of a thing, with its stored facts kept. */
async function itemPatch(
  entry: Pick<PlannableEntry, 'moduleId' | 'id'>,
  patch: Partial<PlanItemRow>,
): Promise<void> {
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

/** „Erledigt“: only for a source that takes it back (an invoice or a cancellation does not: false, nothing happens). */
export async function markDone(
  e: PlannableEntry,
  titles: Record<string, string>,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onDone) return false;
  return act(t.planner.toast.done, t.planner.toast.done, titles, () => s.onDone!(e.id));
}

/** „Später“: the thing's own date becomes tomorrow (an earliest day, never a pin); false for a source without a date. */
export async function later(e: PlannableEntry, titles: Record<string, string>): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onAssign) return false;
  return act(t.planner.toast.later, t.planner.toast.later, titles, () =>
    s.onAssign!(e.id, addDays(today(), 1)),
  );
}

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
    ...(row?.from && row.to ? { from: row.from, to: row.to } : {}),
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

/** A blocker; with `times` ('HH:mm', from before to) it also keeps that stretch of the window free, its minutes = to − from. */
export const addBlocker = (
  date: string,
  label: string,
  min: number,
  titles: Record<string, string>,
  times?: { from: string; to: string },
) =>
  act(t.planner.day.addBlocker, t.planner.toast.blockerAdded, titles, async () => {
    const row = await dayRepo.get(date);
    const span = times ? spanMin(times) : undefined;
    const blocker =
      times && span !== undefined
        ? { id: randomId(), label, min: span, from: times.from, to: times.to }
        : { id: randomId(), label, min };
    await dayPatch(date, { blockers: [...(row?.blockers ?? []), blocker] });
  });

/** The day's own time window (package 5); the minutes stay as they are. */
export const setWindow = (date: string, window: TimeWindow, titles: Record<string, string>) =>
  act(t.planner.day.window, t.planner.toast.window(dayName(date), windowText(window)), titles, () =>
    dayPatch(date, { from: window.from, to: window.to }),
  );

/** Drops the day's own window: the weekday's window of the settings (or none) applies again. */
export const clearWindow = (date: string, titles: Record<string, string>) =>
  act(t.planner.day.windowDefault, t.planner.toast.windowCleared(dayName(date)), titles, () =>
    dayPatch(date, { from: undefined, to: undefined }),
  );

export const removeBlocker = (date: string, id: string, titles: Record<string, string>) =>
  act(t.planner.day.removeBlocker(''), t.planner.toast.blockerRemoved, titles, async () => {
    const row = await dayRepo.get(date);
    await dayPatch(date, { blockers: (row?.blockers ?? []).filter((b) => b.id !== id) });
  });

export const WEEK_TEMPLATES = ['work', 'vacation', 'sick'] as const;
export type WeekTemplate = (typeof WEEK_TEMPLATES)[number];

/**
 * „Woche prüfen“: stores the confirmed minutes of every shown day (only days that differ are written).
 * With a template (package 5) the toast is one calm sentence; „Arbeitswoche“ hands a day that is back
 * at its weekday minutes to the settings again (its own minutes and window are dropped). Only the shown
 * days are touched, never the settings; one undo for all of it.
 */
export const confirmWeek = (
  values: { date: string; availableMin: number; current: number; defaultMin?: number }[],
  titles: Record<string, string>,
  template?: WeekTemplate,
) =>
  act(
    t.planner.check.title,
    template ? t.planner.check.done[template] : t.planner.toast.weekChecked,
    titles,
    async () => {
      for (const v of values) {
        if (template === 'work' && v.availableMin === v.defaultMin) {
          const row = await dayRepo.get(v.date);
          if (row && (row.availableMin !== undefined || row.from || row.to))
            await dayPatch(v.date, { availableMin: undefined, from: undefined, to: undefined });
        } else if (v.availableMin !== v.current)
          await dayPatch(v.date, { availableMin: v.availableMin });
      }
    },
    { leadOnly: template !== undefined },
  );

/** `<module>:<id>` → its parts (the id may contain a colon; the module never does). */
const refOf = (key: string) => {
  const at = key.indexOf(':');
  return { moduleId: key.slice(0, at), id: key.slice(at + 1) };
};

/**
 * „Übernehmen“ of a preview: the ops of a sentence (or „Neu verteilen“) are stored by the planner itself –
 * the day's minutes and blockers, the item flags, the thing's own date (like „Später“) and its estimate
 * through the source, the buffer in the settings – and planned in the same `undoable`, never through
 * `core/ai/write`. One toast with the undo.
 */
export function applyOps(ops: readonly PlanOp[], lead: string, titles: Record<string, string>) {
  const reshuffle = ops.some((o) => o.op === 'replan' && o.reshuffle);
  return act(
    lead,
    lead,
    titles,
    async () => {
      for (const op of ops) {
        switch (op.op) {
          case 'available':
            await dayPatch(op.date, { availableMin: op.min });
            break;
          case 'block': {
            const row = await dayRepo.get(op.date);
            const blocker = {
              id: randomId(),
              label: op.label,
              min: op.min,
              from: op.from,
              to: op.to,
            };
            await dayPatch(op.date, { blockers: [...(row?.blockers ?? []), blocker] });
            break;
          }
          case 'pin':
            await itemPatch(refOf(op.key), { pinned: op.date });
            break;
          case 'priority':
            await itemPatch(refOf(op.key), { priority: op.value });
            break;
          case 'exclude':
            await itemPatch(refOf(op.key), { excluded: true });
            break;
          case 'earliest': {
            const ref = refOf(op.key);
            await (await source(ref.moduleId))?.onAssign?.(ref.id, op.date);
            break;
          }
          case 'duration': {
            const ref = refOf(op.key);
            await (await source(ref.moduleId))?.onEstimate?.(ref.id, op.min);
            break;
          }
          case 'buffer':
            await setSettings(
              PLANNER_SCOPE,
              { bufferShare: String(op.pct) },
              DEFAULT_PLANNER_SETTINGS,
            );
            break;
          case 'replan':
            break;
        }
      }
    },
    { reshuffle },
  );
}
