/**
 * What the planner UI can do: every action is one `undoable` together with the run it causes and its
 * write-backs (`runUser`), and ends in one toast line with the undo (`runToast`). Sources are
 * reached only through the contract (`plannableSource`), never by import.
 */
import { recordWrite } from '@/core/db/recorder';
import { randomId } from '@/core/db/util';
import { formatMinutes } from '@/core/i18n/format';
import { getLang } from '@/core/i18n/lang';
import { plannableSource, type PlannableEntry } from '@/core/modules/contributions';
import { availableManifests } from '@/core/modules/available';
import { addDays } from '@/core/plan/dates';
import { dayName, partWord } from '@/core/plan/explain';
import type { DayPart } from '@/core/plan/types';
import { unitId } from '@/core/plan/units';
import { spanMin, windowText, type TimeWindow } from '@/core/plan/windows';
import { now, today } from '@/core/time/now';
import { undoEntry } from '@/core/undo';
import { NEVER_LINKED, type EntityRef } from '@/core/entitylinks/types';
import type { EventMap } from '@/core/events/events';
import type { CaptureFields } from '@/quickCapture/parser';
import {
  breakOf,
  saveCapture,
  saveCaptures,
  targetFor,
  type SavedCapture,
} from '@/quickCapture/targets';
import type { PlanOp } from '@/core/plan/instructions';
import { setSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import type { SetupThing } from './daySetup';
import { readFieldWithPart } from './dueWords';
import { assignmentRepo, dayRepo, itemKeyOf, itemRepo, putRow } from './repo';
import type { PlanDayRow, PlanItemRow } from './schema';
import { overloadLine } from './overload';
import { getPlannerSettings } from './prefs';
import { PlannerOffError, runUser, type UserRun } from './services';
import { dayEndLabel, DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from './settings';
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
 * on which day it landed: „Im Plan: Vermieter antworten · Di · Rückgängig“. With `ref` the thing is a plan item
 * itself and no ToDo is made (`placeRequested`).
 */
export async function addRequested(req: EventMap['plan.requested']): Promise<boolean> {
  if (req.ref) return placeRequested(req.ref, req);
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

/**
 * `plan.requested` with `ref` („In den Plan“ on a thing that is a plan item itself: a list, an invoice;
 * CONCEPT-SOURCES §3.3): no ToDo. The planner writes only its own item row for `<module>:<id>` – `excluded` off, a
 * hard due when asked – and runs, as one undoable action with the usual toast. For a thing without a date that row
 * is also the request: the run hands its id to the source as `ctx.requested` (`run.ts requestedIds`), and „Nicht
 * planen“ or the undo takes it out again. The ref is untrusted (any module can emit): never the vault, only a
 * module that is a plan source; a thing its source does not list (nothing open, module off) leaves no row behind.
 */
export async function placeRequested(
  ref: EntityRef,
  req: Pick<EventMap['plan.requested'], 'title' | 'due'>,
): Promise<boolean> {
  if (ref.module === NEVER_LINKED || !ref.id || ref.id.length > 128) return false;
  if (!(await source(ref.module).catch(() => undefined))) return false;
  const key = itemKeyOf(ref.module, ref.id);
  let run: UserRun;
  try {
    run = await runUser(t.planner.toast.added, () =>
      itemPatch(
        { moduleId: ref.module, id: ref.id },
        {
          excluded: undefined,
          ...(req.due?.hard ? { due: { date: req.due.date, hard: true } } : {}),
        },
      ),
    );
  } catch (e) {
    if (!(e instanceof PlannerOffError)) throw e;
    toast(t.planner.toast.off);
    return false;
  }
  const title = run.outcome.inputs.titles[key];
  if (title === undefined) {
    // Not a thing of the plan (nothing open on the list, its module is off): the request is taken back.
    if (run.entry) await undoEntry(run.entry.id);
    return false;
  }
  const first = run.outcome.result?.assignments
    .filter((a) => a.itemKey === key)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const line = first
    ? t.planner.toast.requested(short(title), dayName(first.date))
    : t.planner.toast.requestedWaits(short(title));
  toast(withOverload(line, await overloadNotice(run)), run);
  return true;
}

/**
 * `plan.unrequested` („Nicht mehr planen“ on a list): the request ends. Same path as the row's „Nicht planen“
 * (`exclude`): the item row `<module>:<id>` gets `excluded`, so `requestedIds` no longer hands the id to its source;
 * one undo. The ref is untrusted like in `placeRequested`: never the vault, only a module that is a plan source.
 */
export async function unrequest(req: EventMap['plan.unrequested']): Promise<boolean> {
  const ref = req.ref;
  if (ref.module === NEVER_LINKED || !ref.id || ref.id.length > 128) return false;
  if (!(await source(ref.module).catch(() => undefined))) return false;
  const entry = { moduleId: ref.module, id: ref.id };
  return act(
    t.planner.row.exclude,
    t.planner.toast.excluded,
    { [itemKeyOf(ref.module, ref.id)]: req.title },
    () => itemPatch(entry, { excluded: true }),
  );
}

/** What a source takes back from a row of the plan (`PlannableSource`). */
export interface SourceAbility {
  /** A tick („Erledigt“). */
  done: boolean;
  /** „Später“. */
  assign: boolean;
  /** „Als Pause …“: the thing can be removed and brought back. */
  remove: boolean;
  /** „Dauer …“. */
  estimate: boolean;
}

/** Which sources take a tick or „Später“ back (an invoice or a cancellation does not: that stays in its module). */
export async function sourceAbilities(): Promise<Record<string, SourceAbility>> {
  const out: Record<string, SourceAbility> = {};
  await Promise.all(
    availableManifests().map(async (m) => {
      const s = await plannableSource(m).catch(() => undefined);
      if (s)
        out[m.id] = {
          done: !!s.onDone,
          assign: !!s.onAssign,
          remove: !!s.onRemove,
          estimate: !!s.onEstimate,
        };
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
  // „Duschen nachmittags“ (package 4b): the part word becomes the item's part (`readFieldWithPart`).
  const { fields, hardDue, hardDueTime, isBreak, part } = readFieldWithPart(
    text,
    new Date(now()),
    today(),
    getLang() === 'de',
  );
  // „Pause 2 Std Zocken“: a blocker of its day through the quick-capture target, no ToDo (package 4a).
  if (isBreak) {
    const b = breakOf(fields, { today: today() });
    return act(
      t.planner.day.addBlocker,
      t.planner.toast.asBreak(
        short(b.label),
        dayName(b.date),
        formatMinutes(b.min, { compact: true }),
      ),
      titles,
      async () => {
        await saveCapture('break', fields);
      },
      { leadOnly: true },
    );
  }
  // A part word read from the line says so (as a deadline does), so „nachmittags“ is not taken for a title word.
  const lead = hardDue
    ? t.planner.toast.addedWithDue(dayName(hardDue))
    : part && fields.title
      ? t.planner.toast.part(short(fields.title), partWord(part))
      : t.planner.toast.added;
  return act(t.planner.toast.added, lead, titles, async () => {
    const saved = await saveCapture('todo', fields);
    if (hardDue || part)
      await putRow(itemRepo, itemKeyOf(saved.moduleId, saved.id), {
        source: { module: saved.moduleId, id: saved.id },
        ...(hardDue
          ? { due: { date: hardDue, hard: true, ...(hardDueTime ? { time: hardDueTime } : {}) } }
          : {}),
        ...(part ? { part } : {}),
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

/**
 * „Später“: the thing's own date becomes the day after the one it is planned on, never before tomorrow (an
 * earliest day, never a pin) – so it leaves its day whichever day that is; a pin on the thing is lifted in the
 * same undoable step. False for a source without a date.
 */
export async function later(e: PlannableEntry, titles: Record<string, string>): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onAssign) return false;
  return act(t.planner.toast.later, t.planner.toast.later, titles, async () => {
    // A pin beats an earliest day: „Später“ on a nailed thing lifts the pin, or nothing would move.
    if ((await itemRepo.get(itemKeyOf(e.moduleId, e.id)))?.pinned)
      await itemPatch(e, { pinned: undefined });
    // The first session's row is the thing's first day (`<itemKey>#0`); a waiting thing has none.
    const on = (await assignmentRepo.get(unitId(itemKeyOf(e.moduleId, e.id), 0)))?.date;
    await s.onAssign!(e.id, addDays(on && on > today() ? on : today(), 1));
  });
}

/** The lengths „Als Pause …“ offers (minutes): 1 h · 2 h · 3 h. */
export const BREAK_CHOICES = [60, 120, 180] as const;
/** The estimates „Dauer …“ offers: the ToDo editor's values (`todos/components/TaskEditor.tsx` `ESTIMATES`). */
export const ESTIMATE_CHOICES = [5, 15, 30, 60] as const;

/**
 * „Als Pause …“ (use case „Wochenende retten“, package 4a): the thing becomes a blocker of `min` minutes on
 * `date` with its title, and the source removes it (`onRemove`) – leisure never waits as an open task. No
 * planner field and no engine case: a blocker is what the plan already knows. One undo brings back the thing,
 * its plan and takes the blocker out again. False for a source that cannot remove (an invoice stays).
 */
export async function asBreak(
  e: PlannableEntry,
  date: string,
  min: number,
  titles: Record<string, string>,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onRemove) return false;
  const length = formatMinutes(min, { compact: true });
  return act(
    t.planner.row.asBreak,
    t.planner.toast.asBreak(short(e.title), dayName(date), length),
    titles,
    async () => {
      // The thing goes first: a second tap or a thing removed on another device adds no second blocker.
      const restore = await s.onRemove!(e.id);
      if (!restore) return;
      // The source's own undo joins this action: a source whose removal is no recorded write comes back too.
      recordWrite(restore);
      try {
        const row = await dayRepo.get(date);
        await dayPatch(date, {
          blockers: [...(row?.blockers ?? []), { id: randomId(), label: e.title, min }],
        });
      } catch (err) {
        // A failed write drops the action's undo: the thing must not stay removed without its blocker.
        await restore().catch(() => undefined);
        throw err;
      }
    },
    { leadOnly: true },
  );
}

/** „Dauer …“: the thing's estimate through its source (like the sentence op `duration`). */
export async function setEstimate(
  e: PlannableEntry,
  min: number,
  titles: Record<string, string>,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onEstimate) return false;
  return act(
    t.planner.row.estimate,
    t.planner.toast.estimate(short(e.title), formatMinutes(min, { compact: true })),
    titles,
    async () => {
      await s.onEstimate!(e.id, min);
      // A length the plan held itself would hide the new estimate (`run.ts`: the item row wins).
      const key = itemKeyOf(e.moduleId, e.id);
      if ((await itemRepo.get(key))?.durationMin !== undefined)
        await itemPatch(e, { durationMin: undefined });
    },
  );
}

/**
 * „Tagesabschnitt …“ (package 4b): Vormittag / Nachmittag / Abend or none, on the planner's own row. Orders
 * the thing inside its day (and, with a window, where it sits); the engine never moves its day for it.
 */
export const setPart = (
  e: PlannableEntry,
  part: DayPart | undefined,
  titles: Record<string, string>,
) =>
  act(
    t.planner.row.dayPart,
    part
      ? t.planner.toast.part(short(e.title), partWord(part))
      : t.planner.toast.partCleared(short(e.title)),
    titles,
    () => itemPatch(e, { part }),
    { leadOnly: true },
  );

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
    // The source's own hour of that day comes along („Frist So 18:00“); another day has none.
    itemPatch(e, {
      due: {
        date,
        hard: true,
        ...(e.due?.time && e.due.date === date ? { time: e.due.time } : {}),
      },
    }),
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

/**
 * „Übernehmen“ of „Tage einteilen“: the chosen minutes of the shown days (day rows only, never the weekday
 * settings), the dump's things through the quick-capture targets, each line as the capture reads it (one batch, all or nothing; „bis So“
 * makes the planner item's deadline hard, as in the field), the „Tagesende“ when one was chosen (a setting for every
 * day, package 6) and the run – one undoable action, one toast
 * „Eingeplant: Sa, So, Mo · Rückgängig“. A day that was not touched keeps what it had. `reshuffle` (a day gained
 * time, W10): the run distributes anew, so the day takes things – the sheet's preview showed every move.
 */
export function applyDaySetup(
  days: readonly { date: string; min: number }[],
  things: readonly SetupThing[],
  shown: readonly string[],
  titles: Record<string, string>,
  reshuffle = false,
  dayEnd?: string,
) {
  // Only a day end chosen: the toast says that, not „Eingeplant: …“ (nothing was planned).
  const onlyDayEnd = dayEnd !== undefined && days.length === 0 && things.length === 0 && !reshuffle;
  const lead = !onlyDayEnd
    ? t.planner.toast.planned(shown.map(dayName).join(', '))
    : dayEnd
      ? t.planner.daySetup.dayEndSet(dayEndLabel(dayEnd))
      : t.planner.daySetup.dayEndCleared;
  return act(
    lead,
    lead,
    titles,
    async () => {
      // „Tagesende festlegen“ (package 6): the one setting for every day, a recorded write, so the undo takes it back.
      if (dayEnd !== undefined)
        await setSettings(PLANNER_SCOPE, { dayEnd }, DEFAULT_PLANNER_SETTINGS);
      for (const d of days)
        await dayPatch(d.date, { availableMin: Math.max(0, Math.min(1440, d.min)) });
      if (things.length === 0) return;
      // Ids in line order: ToDos saved in the same millisecond tie on their age and the engine then
      // breaks the tie by id – sorted, the plan keeps the order the preview showed. Every other line goes
      // through its own quick-capture target, as the capture saves it (W23): a Termin, a reminder (`once`),
      // a break („Pause …“: a blocker of its day) – no id, no ToDo. All of it is recorded in this one action.
      const ids = things.map(() => randomId()).sort();
      await saveCaptures(
        things.map((th, i) =>
          th.type === 'todo'
            ? { type: th.type, fields: th.fields, id: ids[i] }
            : { type: th.type, fields: th.fields },
        ),
        things.map((th) => th.fields.title).join('\n'),
      );
      const moduleId = targetFor('todo').moduleId;
      for (const [i, th] of things.entries()) {
        if (!th.hardDue || th.type !== 'todo') continue;
        await putRow(itemRepo, itemKeyOf(moduleId, ids[i]!), {
          source: { module: moduleId, id: ids[i]! },
          due: {
            date: th.hardDue,
            hard: true,
            ...(th.hardDueTime ? { time: th.hardDueTime } : {}),
          },
          order: 0,
        });
      }
    },
    { leadOnly: true, reshuffle },
  );
}

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
 * at its weekday minutes to the settings again (its own minutes are dropped, its own window stays). Only the shown
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
          // Back to the weekday minutes; a day's own window stays (the sheet shows minutes only).
          const row = await dayRepo.get(v.date);
          if (row?.availableMin !== undefined) await dayPatch(v.date, { availableMin: undefined });
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
export function applyOps(
  ops: readonly PlanOp[],
  lead: string,
  titles: Record<string, string>,
  /** One calm sentence instead of the moves („Rest verteilen“: never a count of what was left). */
  leadOnly = false,
) {
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
    { reshuffle, leadOnly },
  );
}
