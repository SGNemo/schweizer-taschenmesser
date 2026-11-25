/**
 * What the planner UI can do: every action is one `undoable` together with the run it causes and its
 * write-backs (`runUser`), and ends in one toast line with the undo (`runToast`). Sources are
 * reached only through the contract (`plannableSource`), never by import.
 */
import { recordWrite } from '@/core/db/recorder';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { randomId } from '@/core/db/util';
import { formatMinutes } from '@/core/i18n/format';
import { getLang } from '@/core/i18n/lang';
import {
  activeManifests,
  plannableSource,
  type PlannableEntry,
} from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { availableManifests } from '@/core/modules/available';
import { capacity, fixedCharges } from '@/core/plan/capacity';
import { addDays } from '@/core/plan/dates';
import { dayName, partWord } from '@/core/plan/explain';
import { DEFAULT_MIN, type DayPart } from '@/core/plan/types';
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
import { extractLock, readFieldWithPart } from './dueWords';
import { assignmentRepo, dayRepo, itemKeyOf, itemRepo, putRow } from './repo';
import { planLength, type AssignmentRow, type PlanDayRow, type PlanItemRow } from './schema';
import { overloadLine } from './overload';
import { GOAL_MAX, type Known, type PasteLine, type Place } from './pastePlan';
import { requestedIds } from './run';
import { getPlannerSettings } from './prefs';
import { PlannerOffError, runUser, type RunScope, type UserRun } from './services';
import { dayEndLabel, DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from './settings';
import { runToast } from './toast';
import { measureKey, proposedMinutes, recordMeasure } from './measure';

const toast = (message: string, run?: UserRun, lead?: { label: string; run: () => void }) =>
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
    undefined,
    lead,
  );

/**
 * Runs `act` as one undoable user action with its run and shows the one toast line. False when the
 * module was switched off meanwhile (a stale page): nothing happened, the toast says so.
 */
export async function act(
  label: string,
  lead: string,
  titles: Record<string, string>,
  fn: () => Promise<void | RunScope>,
  opts: {
    reshuffle?: boolean;
    leadOnly?: boolean;
    /** A line read after the run (the day a new thing landed on is full or kept free): it replaces `lead`. */
    leadAfter?: (run: UserRun) => Promise<string | undefined>;
    /** The action hands things to the proposer itself (its scope): a thing without room is named. */
    proposes?: boolean;
    /** A second action before „Rückgängig“ („Ansehen“ of B16, package 5a). */
    view?: { label: string; run: () => void };
  } & RunScope = {},
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
  // `leadOnly`: one calm sentence (a template); the board shows where things went. An action that hands nothing
  // to the engine moved nothing else, so its line is that one fact as well.
  const proposes = opts.proposes || opts.reshuffle || !!opts.loose?.length || !!opts.ops?.length;
  const after = opts.leadAfter ? await opts.leadAfter(run) : undefined;
  const first =
    after ?? (opts.leadOnly || !proposes ? lead : runToast(run.outcome.result, titleOf, lead));
  // A proposal that found no room for a thing says so after „Übernehmen“ too (the thing kept its day).
  const held = proposes ? (run.outcome.result?.heldBack?.length ?? 0) : 0;
  const line = held > 0 ? `${first}\n${t.planner.toast.heldBack(held)}` : first;
  toast(withOverload(line, await overloadNotice(run)), run, opts.view);
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
  if (req.refs) return placeMany(req.refs, req.day === undefined ? today() : req.day);
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
      // Asked into the plan: it lies on today (a deadline is no day).
      return layOn(
        { moduleId: saved.moduleId, id: saved.id, durationMin: fields.estimateMin },
        today(),
      );
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
    run = await runUser(t.planner.toast.added, async () => {
      await itemPatch(
        { moduleId: ref.module, id: ref.id },
        {
          excluded: undefined,
          ...(req.due?.hard ? { due: { date: req.due.date, hard: true } } : {}),
        },
      );
      // A thing that already lies somewhere stays there; one without a day lies on today.
      if ((await rowsOf(key)).length > 0) return { touched: [key] };
      return layOn({ moduleId: ref.module, id: ref.id }, today());
    });
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

/** A ref another module may ask into the plan: never the vault, a sane id, a module that is a plan source. */
async function plannableRef(ref: EntityRef): Promise<boolean> {
  if (ref.module === NEVER_LINKED || !ref.id || ref.id.length > 128) return false;
  return !!(await source(ref.module).catch(() => undefined));
}

/**
 * `plan.requested` with `refs`: „In den Plan …“ of one or several ToDos (todos-plan-state). Every named thing
 * is asked in (its item row live, `excluded` off) and lies on `day` – moved there when it lay elsewhere, each keeps its
 * lock – or, with `null`, has no day („Noch ohne Tag“: a row it had is removed). Nothing else is touched; one action,
 * one undo, one toast. The refs are untrusted like in `placeRequested`; a thing its source does not list leaves its
 * (hidden) row behind – when none is listed, the action is taken back.
 */
export async function placeMany(refs: readonly EntityRef[], day: string | null): Promise<boolean> {
  // A day from today on: the bus is open to every module, a passed day would lay rows straight into „Noch offen“.
  if (day !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today())) return false;
  const valid: EntityRef[] = [];
  const seen = new Set<string>();
  for (const ref of refs.slice(0, 500)) {
    const key = ref.module && ref.id ? itemKeyOf(ref.module, ref.id) : '';
    if (!key || seen.has(key) || !(await plannableRef(ref))) continue;
    seen.add(key);
    valid.push(ref);
  }
  if (valid.length === 0) return false;
  const n = valid.length;
  const line =
    day === null ? t.planner.toast.noDayMany(n) : t.planner.open.movedMany(n, dayName(day));
  let run: UserRun;
  try {
    run = await runUser(t.planner.row.move, async () => {
      const touched: string[] = [];
      for (const ref of valid) {
        const entry = { moduleId: ref.module, id: ref.id };
        const key = itemKeyOf(ref.module, ref.id);
        const item = await itemRepo.get(key);
        // Asked in: a „Nicht planen“ is lifted (the person named the thing); an item row is written only when needed.
        if (!item || item.deletedAt !== null || item.excluded)
          await itemPatch(entry, { excluded: undefined });
        if (day !== null) touched.push(...((await layOn(entry, day)).touched ?? []));
        else {
          for (const r of await rowsOf(key)) await assignmentRepo.remove(r.id);
          touched.push(key);
        }
      }
      return { touched };
    });
  } catch (e) {
    if (!(e instanceof PlannerOffError)) throw e;
    toast(t.planner.toast.off);
    return false;
  }
  if (
    !valid.some((ref) => run.outcome.inputs.titles[itemKeyOf(ref.module, ref.id)] !== undefined)
  ) {
    if (run.entry) await undoEntry(run.entry.id);
    return false;
  }
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
  /** „Nächste Wochen“ (`onLater`). */
  later: boolean;
  /** „Kleiner machen …“ (`onSplitOff`). */
  split: boolean;
}

/** The planner's own module id: its source lists the collective rows (package 2). */
const PLANNER = 'planner';

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
          // A pile row's length is the planner's own (`setEstimate`).
          estimate: !!s.onEstimate || m.id === PLANNER,
          later: !!s.onLater,
          split: !!s.onSplitOff,
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

const ENVELOPE = ['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f'];
const rowOf = (r: AssignmentRow): AssignmentRow =>
  Object.fromEntries(
    Object.entries(r).filter(([k, v]) => v !== undefined && !ENVELOPE.includes(k)),
  ) as AssignmentRow;

/** The stored rows of a thing (a thing in parts from the engine's time has several). */
async function rowsOf(key: string): Promise<(AssignmentRow & { id: string })[]> {
  const rows = (await assignmentRepo.active().toArray()) as (AssignmentRow & { id: string })[];
  return rows.filter((r) => r.itemKey === key);
}

/**
 * Lays a thing on a day (docs/design/planner-rethink/CONCEPT.md §1): its row gets that date – nothing else is
 * touched, the run that follows leaves every other thing where it lies. A thing without a row gets one; a thing in
 * parts moves whole. „fest“ stays with the row. Returns the scope for the run (`touched`: the source hears the day).
 */
async function layOn(
  e: Pick<PlannableEntry, 'moduleId' | 'id'> & { durationMin?: number | undefined },
  date: string,
): Promise<RunScope> {
  const key = itemKeyOf(e.moduleId, e.id);
  const rows = await rowsOf(key);
  if (rows.length === 0)
    await putRow(assignmentRepo, unitId(key, 0), {
      itemKey: key,
      k: 0,
      of: 1,
      date,
      // The length the board showed: the plan's own over the source's.
      minutes: planLength(await itemRepo.get(key), e.durationMin) ?? DEFAULT_MIN,
      order: 0,
      reason: 'new',
    });
  else for (const r of rows) await putRow(assignmentRepo, r.id, rowOf({ ...r, date }));
  return { touched: [key] };
}

/**
 * The one field: a ToDo through the quick-capture target; „bis Do“ or „Frist“ makes the planner item's due hard. A
 * lock word next to a day („Zahnarzt Do fest“, „… lock“, „…!“) lays it there „fest“; without a day the word stays the
 * title. The `p` prefix keeps its pin: the thing lies „fest“ on that day (ANALYSIS R13).
 */
export async function addFromField(
  text: string,
  titles: Record<string, string>,
  shown?: string,
): Promise<boolean> {
  // The phrase is German, like the quick-capture parser (CONCEPT §6c); elsewhere the ⋯ action sets a deadline.
  // „Duschen nachmittags“ (package 4b): the part word becomes the item's part (`readFieldWithPart`).
  const de = getLang() === 'de';
  const day = today();
  const read = (line: string) => readFieldWithPart(line, new Date(now()), day, de);
  let reading = read(text);
  let lockDay: string | undefined;
  const lock = de && !reading.isBreak ? extractLock(text, day) : undefined;
  if (lock) {
    const locked = read(lock.text);
    // A deadline is no day: „Steuer bis Fr fest“ keeps its deadline and locks nothing.
    // Two days in one line („7.12. Do fest“): which one is meant is unclear – nothing is locked.
    const clash = lock.date && locked.fields.date && locked.fields.date !== lock.date;
    const on =
      locked.hardDue || clash
        ? undefined
        : (lock.date ??
          (locked.fields.date && locked.fields.date >= day ? locked.fields.date : undefined));
    // Only next to a day: „Bin fest“ stays a title.
    if (on) {
      reading = locked;
      lockDay = on;
    }
  }
  const { fields, hardDue, hardDueTime, isBreak, part } = reading;
  // „Pause 2 Std Zocken“: a blocker of its day through the quick-capture target, no ToDo (package 4a).
  if (isBreak) {
    const b = breakOf(fields, { today: day });
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
  // „p Zahnarzt Donnerstag“: the plan capture's pin – the day, „fest“ (the global capture's pin becomes the same).
  const pin = fields.pin && fields.pin >= day ? fields.pin : undefined;
  const { pin: _pin, ...todoFields } = fields;
  void _pin;
  // A part word read from the line says so (as a deadline does), so „nachmittags“ is not taken for a title word.
  // The new thing lies on the day on the sheet, else today; a day in the text wins (a deadline is no day).
  const dated = !hardDue && fields.date && fields.date >= day ? fields.date : undefined;
  const fixedOn = lockDay ?? pin;
  const target = fixedOn ?? dated ?? (shown && shown >= day ? shown : day);
  const lead = hardDue
    ? t.planner.toast.addedWithDue(dayName(hardDue))
    : fixedOn
      ? t.planner.toast.laidLocked(short(fields.title ?? ''), dayName(target))
      : part && fields.title
        ? t.planner.toast.part(short(fields.title), partWord(part))
        : t.planner.toast.laid(dayName(target));
  return act(
    t.planner.toast.added,
    lead,
    titles,
    async () => {
      // A new thing without minutes starts with what it took the last times (package 8): the plan's own length,
      // marked, so the row says Z1 until the minutes are set by hand. Its source's estimate stays untouched.
      const measured =
        fields.estimateMin === undefined && fields.title
          ? await proposedMinutes(fields.title)
          : undefined;
      const saved = await saveCapture('todo', todoFields);
      const key = itemKeyOf(saved.moduleId, saved.id);
      const scope = await layOn(
        { moduleId: saved.moduleId, id: saved.id, durationMin: fields.estimateMin ?? measured },
        target,
      );
      if (fixedOn)
        for (const r of await rowsOf(key))
          await putRow(assignmentRepo, r.id, { ...rowOf(r), locked: true });
      if (hardDue || part || measured)
        await putRow(itemRepo, key, {
          source: { module: saved.moduleId, id: saved.id },
          ...(hardDue
            ? { due: { date: hardDue, hard: true, ...(hardDueTime ? { time: hardDueTime } : {}) } }
            : {}),
          ...(part ? { part } : {}),
          ...(measured ? { durationMin: measured, measured: true } : {}),
          order: 0,
        });
      return scope;
    },
    // A deadline or a part says its own fact; otherwise a full or kept-free day says so in the one line.
    hardDue || (part && !fixedOn)
      ? {}
      : { leadAfter: (run) => dayNote(target, run, fixedOn ? lead : undefined) },
  );
}

/**
 * The line after entering on a day that is full or kept free (CONCEPT-COPY): „Liegt auf Mo. Jetzt ist mehr geplant als
 * planbar.“ / „Do ist frei gehalten. Liegt trotzdem dort.“ – a fact, no tone; undefined on an ordinary day (the lead
 * stays). Counted as the board counts: the open things' rows of that day and the dated turns shown there.
 */
async function dayNote(
  date: string,
  run: UserRun,
  /** The lead to keep („Zahnarzt liegt auf Do · fest“); without one the plain „Liegt auf Mo.“ form is used. */
  keep: string | undefined,
): Promise<string | undefined> {
  const inputs = run.outcome.inputs;
  const plan = inputs.days.find((d) => d.date === date);
  if (!plan) return undefined;
  if (plan.availableMin === 0)
    return keep
      ? `${keep}\n${t.planner.toast.keptFree(dayName(date))}`
      : t.planner.toast.keptFree(dayName(date));
  const open = new Set(
    inputs.entries.filter((e) => !e.done).map((e) => itemKeyOf(e.moduleId, e.id)),
  );
  const rows = ((await assignmentRepo.active().toArray()) as AssignmentRow[]).filter(
    (r) => r.date === date && open.has(r.itemKey) && !inputs.removeKeys.has(r.itemKey),
  );
  // As the board counts: a fixed block only what no timed blocker covers, a dated turn on its day.
  const timed = rows.filter((r) => r.from && r.to);
  const charges = fixedCharges(
    timed.map((r) => ({ minutes: r.minutes, from: r.from, to: r.to })),
    plan.blockers,
  );
  const turns = inputs.turns.filter((x) => x.date === date);
  const turnMin = turns.reduce((n, x) => {
    const item = inputs.items.find((i) => `${i.key}#0` === x.id);
    return n + (item?.durationMin ?? DEFAULT_MIN);
  }, 0);
  const planned =
    rows.filter((r) => !(r.from && r.to)).reduce((n, r) => n + r.minutes, 0) +
    charges.reduce((n, c) => n + c, 0) +
    turnMin;
  if (planned <= capacity(plan, inputs.settings).usable) return undefined;
  return keep ? `${keep}\n${t.planner.toast.overNow}` : t.planner.toast.laidOver(dayName(date));
}

/** „Erledigt“: only for a source that takes it back (an invoice or a cancellation does not: false, nothing happens). */
export async function markDone(
  e: PlannableEntry,
  titles: Record<string, string>,
  /** The minutes a focus round ran (package 8): recorded in this same act, so its undo takes the record back too. */
  ran?: number,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onDone) return false;
  return act(t.planner.toast.done, t.planner.toast.done, titles, async () => {
    await s.onDone!(e.id);
    if (ran !== undefined) await recordMeasure(measureKey(e), ran);
  });
}

/** What a „Los“ step ran (package 8): the step's key and minutes, recorded inside the act that ticks it. */
export type StepRan = { key: string | undefined; minutes: number };

/**
 * One step of a thing ticked or unticked from the plan („Los“, package 5a): the source's `onStepDone` in its own `act`
 * – one undo entry, the quiet toast B26 „Schritt erledigt. · Rückgängig“. False for a source without steps.
 */
export async function markStep(
  e: PlannableEntry,
  stepId: string,
  done: boolean,
  titles: Record<string, string>,
  ran?: StepRan,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onStepDone) return false;
  return act(
    t.planner.steps.stepDone,
    t.planner.steps.stepDone,
    titles,
    async () => {
      await s.onStepDone!(e.id, stepId, done);
      if (ran) await recordMeasure(ran.key, ran.minutes);
    },
    { leadOnly: true },
  );
}

/**
 * B23 „Fertig“ on the last open step („Los“, package 5a): the step and the thing that carries it in **one** `act` – one
 * undo entry brings back both – with the thing's own toast („Erledigt.“). A thing its source does not tick (a list) only
 * finishes the step.
 */
export async function finishSteps(
  e: PlannableEntry,
  stepId: string,
  titles: Record<string, string>,
  ran?: StepRan,
): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onStepDone) return false;
  const label = s.onDone ? t.planner.toast.done : t.planner.steps.stepDone;
  return act(label, label, titles, async () => {
    await s.onStepDone!(e.id, stepId, true);
    if (s.onDone) await s.onDone(e.id);
    if (ran) await recordMeasure(ran.key, ran.minutes);
  });
}

/**
 * „Später“: the thing's row moves to the day after the one it lies on, never before tomorrow. Nothing else moves and
 * „fest“ stays with it. False for a source without a date.
 */
export async function later(e: PlannableEntry, titles: Record<string, string>): Promise<boolean> {
  const s = await source(e.moduleId);
  if (!s?.onAssign) return false;
  // The thing's row moves to the day after the one it lies on, never before tomorrow; nothing else moves and
  // „fest“ stays with it.
  // A dated turn without a row lies on its source's day.
  const on = (await rowsOf(itemKeyOf(e.moduleId, e.id))).map((r) => r.date).sort()[0] ?? e.day;
  const to = addDays(on && on > today() ? on : today(), 1);
  return act(t.planner.toast.later, await laidLine(e, to), titles, () => layOn(e, to));
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
  // A pile row (package 2) is the planner's own thing: its length lives on its own item row.
  if (e.moduleId === PLANNER)
    return act(
      t.planner.row.estimate,
      t.planner.toast.estimate(short(e.title), formatMinutes(min, { compact: true })),
      titles,
      () => itemPatch(e, { durationMin: min, measured: undefined }),
    );
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
        await itemPatch(e, { durationMin: undefined, measured: undefined });
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

/**
 * „Verschieben …“, `M` and a drop on a day (package 5): the thing lies on that day and nothing else moves; one undo. A
 * full or kept-free target says so in the toast – the one live message of the move.
 */
export async function moveTo(e: PlannableEntry, date: string, titles: Record<string, string>) {
  const line = await laidLine(e, date);
  const plain = line === t.planner.toast.laid(dayName(date));
  return act(t.planner.row.move, line, titles, () => layOn(e, date), {
    leadAfter: (run) => dayNote(date, run, plain ? undefined : line),
  });
}

/**
 * The toast of a move by hand: „Liegt auf Mi“ – or, for a thing that is „fest“, „Steuer liegt auf Mi · fest“: the lock
 * moved with it (it binds proposals, not him), never released silently.
 */
async function laidLine(e: Pick<PlannableEntry, 'moduleId' | 'id' | 'title'>, date: string) {
  const locked = (await rowsOf(itemKeyOf(e.moduleId, e.id))).some((r) => r.locked);
  return locked
    ? t.planner.toast.laidLocked(short(e.title), dayName(date))
    : t.planner.toast.laid(dayName(date));
}

/**
 * „Hierher legen“ (the muted row „In ToDos: Do“) and „Übernehmen“ of a chip „Vorschlag: Do“: the thing lies on that
 * day. The same move as „Verschieben …“ – one row, one undo; the ToDo hears the day as for every laid thing.
 */
export async function layHere(e: PlannableEntry, date: string, titles: Record<string, string>) {
  const line = await laidLine(e, date);
  const plain = line === t.planner.toast.laid(dayName(date));
  // A full or kept-free day says so, as when entering in the field.
  return act(t.planner.chips.place, line, titles, () => layOn(e, date), {
    leadAfter: (run) => dayNote(date, run, plain ? undefined : line),
  });
}

/**
 * „Rest verteilen“ of one day (the line „2 h 10 mehr als planbar“): the things of that day that are not „fest“ go to the
 * proposer – that day first, else a later one; nothing before it. The preview showed exactly this; one undo. The toast
 * says what stayed: the fixed ones („1 bleibt: fest“), a thing without room („… kein Platz“).
 */
export function spreadDay(
  date: string,
  loose: readonly string[],
  fixed: number,
  titles: Record<string, string>,
) {
  // The toast says what is true at „Übernehmen“: the fixed ones counted then, nothing „verteilt“ when nothing went.
  let still: string[] = [];
  let fixedNow = fixed;
  const lineOf = () =>
    still.length === 0
      ? fixedNow > 0
        ? t.planner.spread.fixed(fixedNow)
        : t.planner.preview.nothing
      : fixedNow > 0
        ? `${t.planner.spread.done}\n${t.planner.spread.fixed(fixedNow)}`
        : t.planner.spread.done;
  return act(
    t.planner.rest.link,
    t.planner.spread.done,
    titles,
    async () => {
      // As it is now, not as the preview found it: a thing locked, moved or cut into parts meanwhile is not handed
      // over (the preview's own rule: one unlocked row on that day).
      still = [];
      for (const key of loose) {
        const rows = await rowsOf(key);
        if (rows.length === 1 && rows[0]!.of === 1 && rows[0]!.date === date) {
          if (rows[0]!.locked) fixedNow += 1;
          else still.push(key);
        }
      }
      return { loose: still, notBefore: date };
    },
    { leadOnly: true, proposes: true, leadAfter: async () => lineOf() },
  );
}

/**
 * „Auf einen Tag …“ of a selection, and „Alle auf heute“ of the tab „Noch offen“ (planner rethink, package 3): every
 * named thing lies on `date` – each keeps its lock, nothing else moves. One action, one undo, one toast.
 */
export function moveMany(
  entries: readonly PlannableEntry[],
  date: string,
  titles: Record<string, string>,
  lead = t.planner.open.movedMany(entries.length, dayName(date)),
) {
  return act(t.planner.row.move, lead, titles, async () => {
    const touched: string[] = [];
    for (const e of entries) touched.push(...((await layOn(e, date)).touched ?? []));
    return { touched };
  });
}

/** „Alle auf heute“: every thing of the tab „Noch offen“ lies on today – one tap, one undo (CONCEPT §3). */
export const allToday = (entries: readonly PlannableEntry[], titles: Record<string, string>) =>
  moveMany(entries, today(), titles, t.planner.open.allTodayDone);

/**
 * „Verteilen …“ of the tab „Noch offen“: its things that are not „fest“ go to the proposer – today first, nothing
 * before it. The preview showed exactly this; at „Übernehmen“ only what still lies unlocked on a passed day is
 * handed over (a thing laid or locked meanwhile stays out). The fixed ones stay and are named; one undo.
 */
export function spreadOpen(keys: readonly string[], fixed: number, titles: Record<string, string>) {
  const day = today();
  let still: string[] = [];
  let fixedNow = fixed;
  const lineOf = () =>
    still.length === 0
      ? fixedNow > 0
        ? t.planner.spread.fixed(fixedNow)
        : t.planner.preview.nothing
      : fixedNow > 0
        ? `${t.planner.spread.done}\n${t.planner.spread.fixed(fixedNow)}`
        : t.planner.spread.done;
  return act(
    t.planner.open.spread,
    t.planner.spread.done,
    titles,
    async () => {
      still = [];
      for (const key of keys) {
        const rows = await rowsOf(key);
        if (rows.length !== 1 || rows[0]!.of !== 1 || rows[0]!.date >= day) continue;
        if (rows[0]!.locked) fixedNow += 1;
        else still.push(key);
      }
      return { loose: still, notBefore: day };
    },
    { leadOnly: true, proposes: true, leadAfter: async () => lineOf() },
  );
}

/**
 * „Vom Tag nehmen“ (offered on a thing open for more than 14 days): its rows go, the thing is „Noch ohne Tag“ again.
 * The source hears it (a date the planner wrote goes with the row, the person's own date stays). One undo.
 */
export const takeOff = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.open.takeOff, t.planner.open.takenOff(short(e.title)), titles, async () => {
    const key = itemKeyOf(e.moduleId, e.id);
    for (const r of await rowsOf(key)) await assignmentRepo.remove(r.id);
    return { touched: [key] };
  });

/**
 * What „Plan einfügen“ recognises (TARGET §3): every open thing of the active sources with its place (its first row,
 * else a dated turn's day, else „Noch ohne Tag“), timed blocks included (known, never moved), and the things the
 * sources keep for „Nächste Wochen“. Reads only. Unlike the board it **throws** when a source fails to list: matching
 * against a missing source would make every one of its things „neu“ – a second ToDo of the same title.
 */
export async function pasteKnown(): Promise<Known[]> {
  const day = today();
  const manifests = activeManifests(await loadModuleStates());
  // Things asked into the plan (a shopping list without a date) are listed only with their requests, as on the board.
  const requested = requestedIds(await itemRepo.active().toArray());
  const entries: PlannableEntry[] = [];
  for (const m of manifests) {
    const s = await plannableSource(m);
    if (!s) continue;
    const asked = requested[m.id];
    const ctx = { today: day, until: addDays(day, 60) };
    for (const item of await s.list(asked?.length ? { ...ctx, requested: [...asked] } : ctx))
      entries.push({ ...item, moduleId: m.id });
  }
  const first = new Map<string, string>();
  const locked = new Set<string>();
  for (const r of (await assignmentRepo.active().toArray()) as AssignmentRow[]) {
    // A thing's place is its first row from today on (a part still open yesterday does not count), else its earliest.
    const had = first.get(r.itemKey);
    const better = !had || (r.date >= day ? had < day || r.date < had : had < day && r.date < had);
    if (better) first.set(r.itemKey, r.date);
    if (r.locked) locked.add(r.itemKey);
  }
  const out: Known[] = [];
  const canLater = new Set<string>();
  for (const m of manifests) {
    const s = await plannableSource(m);
    // The two steps come together: keeping for later without listing it would double the thing on the next paste.
    if (!s?.onLater || !s.listLater) continue;
    canLater.add(m.id);
    for (const item of await s.listLater())
      out.push({
        key: itemKeyOf(m.id, item.id),
        title: item.title,
        place: { kind: 'later' },
        canLater: true,
      });
  }
  for (const e of entries) {
    const key = itemKeyOf(e.moduleId, e.id);
    const date = first.get(key) ?? e.day;
    out.push({
      key,
      title: e.title,
      place: date ? { kind: 'day', date } : { kind: 'week' },
      canLater: canLater.has(e.moduleId),
      ...(locked.has(key) ? { locked: true } : {}),
      ...(e.day ? { dated: true } : {}),
      ...(e.fixed ? { fixed: true } : {}),
    });
  }
  return out;
}

/**
 * One thing to its pasted place: a day (its row moves there, „fest“ stays with it), „Noch ohne Tag“ (its rows go) or
 * „Nächste Wochen“ (its rows go, the source keeps it for later). A thing that was kept for later is taken back first.
 */
async function placeAt(
  ref: { moduleId: string; id: string },
  to: Place,
  minutes?: number,
): Promise<void> {
  const s = await source(ref.moduleId);
  // Back from later (also when it went there meanwhile on another device: the step is idempotent).
  if (to.kind !== 'later') await s?.onLater?.(ref.id, false);
  if (to.kind === 'day') {
    await layOn({ ...ref, durationMin: minutes }, to.date);
    return;
  }
  for (const r of await rowsOf(itemKeyOf(ref.moduleId, ref.id))) await assignmentRepo.remove(r.id);
  if (to.kind === 'later') await s?.onLater?.(ref.id, true);
}

/**
 * „Übernehmen“ of „Plan einfügen“: every ticked line that changes something – a new thing becomes a ToDo (through the
 * quick-capture target, as the field does), a known one moves – plus the missing things he sent to „Nächste Wochen“.
 * Nothing else moves; one action, one undo, one toast.
 */
export async function applyPaste(
  lines: readonly PasteLine[],
  toLater: readonly Known[],
  titles: Record<string, string>,
  /** The paste's goal line for the days it names (P2), in the same undo entry. */
  goal?: { text: string; dates: readonly string[] },
): Promise<boolean> {
  // Only the days whose goal differs: the same paste twice writes nothing.
  const goalDates: string[] = [];
  for (const date of goal?.dates ?? [])
    if ((await dayRepo.get(date))?.note !== goal!.text) goalDates.push(date);
  // Everything is like that already: no action, no toast, no undo entry.
  if (!goalDates.length && toLater.length === 0 && lines.every((l) => l.change === 'same'))
    return false;
  const toLaterAny =
    toLater.length > 0 || lines.some((l) => l.change !== 'same' && l.to.kind === 'later');
  return act(
    t.planner.paste.title,
    toLaterAny ? t.planner.paste.doneLater : t.planner.paste.done,
    titles,
    async () => {
      const touched: string[] = [];
      for (const line of lines) {
        if (line.change === 'same') continue;
        const ref = line.known
          ? refOf(line.known.key)
          : await saveCapture('todo', {
              title: line.title,
              ...(line.minutes ? { estimateMin: line.minutes } : {}),
            });
        await placeAt(ref, line.to, line.minutes);
        touched.push(itemKeyOf(ref.moduleId, ref.id));
      }
      for (const k of toLater) {
        await placeAt(refOf(k.key), { kind: 'later' });
        touched.push(k.key);
      }
      for (const date of goalDates) await dayPatch(date, { note: goal!.text });
      return { touched };
    },
    { leadOnly: true },
  );
}

/**
 * The goal line of days (use case „Tag kippt“, P2): „Ziel: Wohnung frei bekommen“ on the sheet of each named day –
 * stored as the day's `note`, text only, no progress. `undefined` removes it from those days. One undo.
 */
export function setGoal(
  dates: readonly string[],
  goal: string | undefined,
  titles: Record<string, string>,
) {
  const text = goal?.trim().slice(0, GOAL_MAX) || undefined;
  return act(
    t.planner.goal.title,
    text ? t.planner.goal.set(short(text)) : t.planner.goal.removed,
    titles,
    async () => {
      for (const date of dates) await dayPatch(date, { note: text });
    },
    { leadOnly: true },
  );
}

/**
 * „Kleiner machen …“ (use case „Tag kippt“, P1): the thing becomes its first step – same id, so it keeps its day, lock
 * and order in the plan – and the rest becomes a new thing of the old title, „Noch ohne Tag“ or „Nächste Wochen“.
 * The titles are the source's (`onSplitOff`), never the planner's. One action, one undo.
 */
export async function makeSmaller(
  e: PlannableEntry,
  todayTitle: string,
  rest: 'week' | 'later',
  titles: Record<string, string>,
): Promise<boolean> {
  const s = await source(e.moduleId);
  const step = todayTitle.trim();
  if (!s?.onSplitOff || !step || step === e.title.trim()) return false;
  const m = t.planner.smaller;
  let split = false;
  return act(
    m.menu,
    m.done(short(step), rest === 'later' ? m.doneLater : m.doneWeek),
    titles,
    async () => {
      const id = await s.onSplitOff!(e.id, step);
      split = !!id;
      if (!id) return { touched: [] };
      if (rest === 'later') await s.onLater?.(id, true);
      return { touched: [itemKeyOf(e.moduleId, e.id), itemKeyOf(e.moduleId, id)] };
    },
    // Done or gone meanwhile: nothing was split, the toast says so instead of the step.
    { leadOnly: true, leadAfter: async () => (split ? undefined : t.planner.preview.nothing) },
  );
}

/** Where „Nur das hier …“ sends the rest: the next day, „Noch ohne Tag“ or „Nächste Wochen“. */
export type RestTarget = 'next' | 'week' | 'later';

/** The things „Nur das hier“ named as starting points: date → item key (device-local; passed days are dropped). */
export const START_KEY = 'planner.start';
export type StartPoints = Record<string, string>;

/** Sets or clears (`itemKey` undefined) the starting point of a day. */
export async function setStartPoint(date: string, itemKey: string | undefined): Promise<void> {
  const day = today();
  const now = (await getMeta<StartPoints>(START_KEY)) ?? {};
  const next = Object.fromEntries(Object.entries(now).filter(([d]) => d >= day && d !== date));
  if (itemKey) next[date] = itemKey;
  await setMeta(START_KEY, next);
}

/**
 * „Nur das hier …“ (use case „Tag kippt“, TARGET §2): what he ticked stays on `date`, every other named thing of that
 * day goes in one move – to the next day, to „Noch ohne Tag“ or to „Nächste Wochen“ (a source without that step: no
 * day). Things that are „fest“ stay and are named. One action, one undo; the first thing that stays becomes the day's
 * starting point.
 */
export async function keepOnly(
  date: string,
  keep: readonly string[],
  rest: readonly PlannableEntry[],
  to: RestTarget,
  titles: Record<string, string>,
): Promise<boolean> {
  const next = addDays(date, 1);
  const k = t.planner.keep;
  const lead = to === 'next' ? k.toNext(dayName(next)) : to === 'week' ? k.toWeek : k.toLater;
  const place: Place =
    to === 'next'
      ? { kind: 'day', date: next }
      : to === 'week'
        ? { kind: 'week' }
        : { kind: 'later' };
  let fixed = 0;
  const ok = await act(
    k.title(rest.length),
    lead,
    titles,
    async () => {
      fixed = 0;
      const touched: string[] = [];
      for (const e of rest) {
        const key = itemKeyOf(e.moduleId, e.id);
        if ((await rowsOf(key)).some((r) => r.locked)) {
          fixed += 1;
          continue;
        }
        await placeAt(e, place);
        touched.push(key);
      }
      return { touched };
    },
    {
      leadOnly: true,
      leadAfter: async () => (fixed > 0 ? `${lead}\n${t.planner.spread.fixed(fixed)}` : undefined),
    },
  );
  if (ok && keep[0]) await setStartPoint(date, keep[0]);
  return ok;
}

/** The things the sources keep for „Nächste Wochen“, for the planner's folded group. Reads only. */
export async function laterThings(
  manifests?: readonly ModuleManifest[],
): Promise<PlannableEntry[]> {
  const out: PlannableEntry[] = [];
  for (const m of manifests ?? activeManifests(await loadModuleStates())) {
    const s = await plannableSource(m);
    if (!s?.listLater) continue;
    for (const item of await s.listLater().catch(() => [])) out.push({ ...item, moduleId: m.id });
  }
  return out;
}

/** „Diese Woche“ on a thing of „Nächste Wochen“: it is back under „Noch ohne Tag“. One undo. */
export const bringBack = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.keep.back, t.planner.keep.backDone(short(e.title)), titles, async () => {
    await (await source(e.moduleId))?.onLater?.(e.id, false);
    return { touched: [itemKeyOf(e.moduleId, e.id)] };
  });

/** „Fest an diesem Tag“ / „Nicht mehr fest“: the lock on the thing's rows. No proposal takes a thing that is fest. */
export async function setLocked(
  e: PlannableEntry,
  locked: boolean,
  titles: Record<string, string>,
  /** The day the row shows on: a dated turn without a stored row gets its row there (CONCEPT-MIGRATION §6). */
  shownOn?: string,
): Promise<boolean> {
  // The toast names the day the thing lies on („Fest am Mi“).
  const on = (await rowsOf(itemKeyOf(e.moduleId, e.id))).map((r) => r.date).sort()[0] ?? shownOn;
  // Nothing lies anywhere: nothing to lock, no toast, no undo entry.
  if (on === undefined) return false;
  return act(
    locked ? t.planner.row.pin : t.planner.row.unpin,
    locked ? t.planner.toast.pinned(dayName(on ?? today())) : t.planner.toast.unpinned,
    titles,
    async () => {
      const key = itemKeyOf(e.moduleId, e.id);
      const rows = await rowsOf(key);
      if (rows.length === 0 && locked && shownOn) {
        await layOn(e, shownOn);
        for (const r of await rowsOf(key))
          await putRow(assignmentRepo, r.id, { ...rowOf(r), locked: true });
        return { touched: [key] };
      }
      for (const r of rows) {
        const { locked: _was, ...rest } = rowOf(r);
        void _was;
        await putRow(assignmentRepo, r.id, locked ? { ...rest, locked: true } : rest);
      }
    },
  );
}

export const exclude = (e: PlannableEntry, titles: Record<string, string>) =>
  act(t.planner.row.exclude, t.planner.toast.excluded, titles, () =>
    itemPatch(e, { excluded: true }),
  );

/**
 * „Weglassen“ of a training whose day passed unlogged (`passed.ts`): the planner's own item row keeps that day as
 * `skipped`, so today's page asks no more. The source keeps the session as it is; one undo brings the question back.
 */
export const skipPassed = (e: PlannableEntry, date: string, titles: Record<string, string>) =>
  act(
    t.planner.passed.skip,
    t.planner.passed.skipped,
    titles,
    () => itemPatch(e, { skipped: date }),
    {
      leadOnly: true,
    },
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
  /** The sheet's proposal lays something (what waited without a day, package 6). */
  proposes = false,
) {
  // Only a day end chosen: the toast says that, not „Eingeplant: …“ (nothing was planned).
  const onlyDayEnd =
    dayEnd !== undefined && days.length === 0 && things.length === 0 && !reshuffle && !proposes;
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
      if (things.length === 0) return undefined;
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
      return {
        loose: things.flatMap((th, i) =>
          th.type === 'todo' ? [itemKeyOf(moduleId, ids[i]!)] : [],
        ),
      };
    },
    // „Tage einteilen“ spreads the typed things and what has no day yet; `reshuffle` (a day gained time) hands
    // over everything that is not „fest“ – the sheet's preview showed exactly that.
    { leadOnly: true, reshuffle, ops: [{ op: 'replan', reshuffle }] },
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
  // What the sentence hands to the engine is read from its ops like in the preview; a named move is laid here.
  const handed = ops.filter((o) => o.op !== 'pin');
  return act(
    lead,
    lead,
    titles,
    async () => {
      const touched: string[] = [];
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
            // „schieb X auf Mi“: a move – the thing lies there, it is not „fest“ by that.
            touched.push(...((await layOn(refOf(op.key), op.date)).touched ?? []));
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
          // „In Teile aufteilen …“ (package 6): the thing may be cut into parts from now on – a recorded write.
          case 'split':
            await itemPatch(refOf(op.key), { splittable: true });
            break;
        }
      }
      return { touched };
    },
    { reshuffle, leadOnly, ops: handed },
  );
}
