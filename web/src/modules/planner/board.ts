/**
 * The pure model behind the week board, the day sheet and the widget: stored rows + the live inputs →
 * one object per day with its capacity line, rows and blockers, plus the waiting list. The engine is
 * not run here; the board shows what the last run stored (`assignment` rows, `LastRun`).
 */
import type { PlanBlockEntry, PlannableEntry } from '@/core/modules/contributions';
import { isPlannerOwned, type CalendarItem } from '@/core/modules/types';
import { capacity, fixedCharges } from '@/core/plan/capacity';
import { cmp } from '@/core/plan/dates';
import { DEFAULT_MIN, type PlaceReason, type Unplaced } from '@/core/plan/types';
import { fixedOf, planDays, turnDayOf, type DayBlocker } from './days';
import { lateMoneyDue } from './late';
import { itemKeyOf } from './repo';
import type { AssignmentRow, PlanDayRow, PlanItemRow } from './schema';
import { defaultAvailable, type PlannerSettings } from './settings';
import { addDaysStr as addDaysIso, isoWeekday, toEpoch } from '@/core/time/dates';

export type BoardBlocker = DayBlocker;

export interface BoardRow {
  unitId: string;
  itemKey: string;
  title: string;
  minutes: number;
  k: number;
  of: number;
  reason: PlaceReason;
  bumpedBy?: string[];
  late?: boolean;
  /** No estimate on the source: shown as „~30 Min“. */
  approx: boolean;
  pinned: boolean;
  hardDue?: string;
  /** The deadline's hour ('HH:mm', package 5b), only next to `hardDue`. */
  hardDueTime?: string;
  /** The source's own date before the planner (for „Warum hier?“ of a carried thing). */
  entry?: PlannableEntry;
  item?: PlanItemRow;
  /**
   * A fixed block (planner hub S4, a training at 18:00): its time on this day. Shown with the day's blocks, never
   * moved, never late; it takes from the day only what no timed blocker covers already.
   */
  fixed?: { from: string; to: string };
  /**
   * A dated turn of its source (a training, a routine's occurrence – `PlannableItem.day`) shown on its day without a
   * stored row (planner rethink, CONCEPT-MIGRATION §6). Moving or locking it writes the row.
   */
  derived?: true;
}

/**
 * „In ToDos: Do · Hierher legen“ (CONCEPT-MIGRATION §4): a date set in ToDos that the plan does not hold – the thing
 * has no row, or its row lies on another day. Derived at read time, never stored, counts for no load.
 */
export interface TodoHint {
  itemKey: string;
  title: string;
  /** The ToDo's own date (= the day this hint stands on). */
  date: string;
  entry: PlannableEntry;
}

/** A row on a day that has passed („Noch offen“): the row and the day it lies on. */
export type OpenRow = BoardRow & { date: string };

export interface BoardDay {
  date: string;
  isToday: boolean;
  /** Stored row, if the user touched the day. */
  row?: PlanDayRow;
  availableMin: number;
  raw: number;
  usable: number;
  planned: number;
  free: number;
  over: number;
  /** 0 minutes available: a day off. */
  off: boolean;
  /** The weekday's minutes from the settings (the „Arbeitswoche“ template). */
  defaultMin: number;
  /** The day's time window (its own or the weekday's), package 5. */
  window?: { from: string; to: string };
  /** The window is the day's own. */
  ownWindow?: boolean;
  blockers: BoardBlocker[];
  rows: BoardRow[];
  /** Muted rows „In ToDos: Do“ (never counted); empty when left out. */
  hints?: TodoHint[];
}

export interface WaitingRow {
  unitId: string;
  itemKey: string;
  title: string;
  minutes: number;
  k: number;
  of: number;
  /** `later`: laid on `date`, a day after the board's last one. */
  reason: Unplaced['reason'] | 'excluded' | 'later';
  date?: string;
  bumpedBy?: string[];
  entry?: PlannableEntry;
  item?: PlanItemRow;
  /** The hard deadline („Frist Fr“): such a thing gets the chip „Vorschlag: Do · Frist Fr“. */
  hardDue?: string;
  /** A date set in ToDos that lies before today or beyond the board's days: the chip „In ToDos: Mo 16.“. */
  todoDate?: string;
}

export interface Board {
  days: BoardDay[];
  waiting: WaitingRow[];
  /**
   * „Frist vorbei“ (planner hub R2, D7): money whose hard deadline has passed – on no day, in no day's sum, not
   * in `waiting`. Oldest deadline first. A thing set to „Nicht planen“ is not listed here (it waits, as before).
   */
  late: BoardRow[];
  /** „Noch offen“: rows on a day before today whose thing is not done, „fest“ first, then by day. */
  open: OpenRow[];
  /** Open things in the plan today (first sessions). */
  todayCount: number;
}

export interface BoardInput {
  today: string;
  /** How many days from today. */
  span: number;
  settings: PlannerSettings;
  dayRows: readonly (PlanDayRow & { id: string })[];
  itemRows: readonly (PlanItemRow & { id: string })[];
  assignments: readonly (AssignmentRow & { id: string })[];
  entries: readonly PlannableEntry[];
  calendar: readonly CalendarItem[];
  /** Blocks of time modules keep free (habits, S4). */
  blocks?: readonly PlanBlockEntry[];
  unplaced: readonly Unplaced[];
  titles?: Record<string, string>;
}

export const unitTitle = (titles: Record<string, string>, unitId: string): string =>
  titles[unitId.slice(0, unitId.lastIndexOf('#'))] ?? unitId;

/**
 * A row's hard deadline and its hour: for the same day the source is the authority (the ToDo editor may have
 * changed or cleared the hour since); for another day the plan row's own hour.
 */
function dueOf(
  due: { date: string; time?: string },
  source?: { date: string; time?: string },
): Pick<BoardRow, 'hardDue' | 'hardDueTime'> {
  const time = source?.date === due.date ? source.time : due.time;
  return { hardDue: due.date, ...(time ? { hardDueTime: time } : {}) };
}

/**
 * „Frist war …“ instead of „Frist …“ (package 5b): the session lies after the deadline, or the deadline itself
 * has passed – its day is over, or its hour on that day (`at` = now, epoch ms). Calm text either way, never red.
 */
export function dueWas(
  row: Pick<BoardRow, 'hardDue' | 'hardDueTime' | 'late'>,
  at: number,
): boolean {
  if (!row.hardDue) return false;
  if (row.late) return true;
  const end = toEpoch(row.hardDue, row.hardDueTime ?? '23:59') + (row.hardDueTime ? 0 : 60_000);
  return at >= end;
}

export function buildBoard(input: BoardInput): Board {
  const entries = new Map(input.entries.map((e) => [itemKeyOf(e.moduleId, e.id), e]));
  const items = new Map(input.itemRows.map((r) => [r.id, r]));
  const titles: Record<string, string> = { ...input.titles };
  for (const [key, e] of entries) titles[key] = e.title;
  const bufferShare = Number(input.settings.bufferShare) / 100;
  // Late money: off the days at once, also before the next run has dropped its stored rows.
  const lateDue = new Map<string, string>();
  for (const [key, e] of entries) {
    const due = lateMoneyDue(e, items.get(key), input.today);
    if (due) lateDue.set(key, due);
  }
  const late: BoardRow[] = [...lateDue]
    .filter(([key]) => !items.get(key)?.excluded)
    .map(([key, due]) => {
      const entry = entries.get(key)!;
      const item = items.get(key);
      return {
        unitId: `${key}#0`,
        itemKey: key,
        title: entry.title,
        minutes: item?.durationMin ?? entry.durationMin ?? DEFAULT_MIN,
        k: 0,
        of: 1,
        reason: 'deadline' as const,
        late: true,
        approx: item?.durationMin === undefined && entry.durationMin === undefined,
        pinned: false,
        hardDue: due,
        entry,
        ...(item ? { item } : {}),
      };
    })
    .sort(
      (a, b) =>
        a.hardDue!.localeCompare(b.hardDue!) ||
        (a.entry?.createdAt ?? 0) - (b.entry?.createdAt ?? 0) ||
        a.itemKey.localeCompare(b.itemKey),
    );
  // A row is shown while its thing is open (planner rethink: one selector hides, nothing is tidied): a thing that
  // is done is hidden at once; one that no source lists and the last pass did not know either (its module is off)
  // is hidden until it is back. The stored row stays either way.
  const shown = (a: AssignmentRow): boolean => {
    const entry = entries.get(a.itemKey);
    return entry ? !entry.done : titles[a.itemKey] !== undefined;
  };
  const toRow = (a: AssignmentRow & { id: string }, date: string): BoardRow => {
    const entry = entries.get(a.itemKey);
    const item = items.get(a.itemKey);
    // Fixed on this day by its source (S4); the run stored its time with the row.
    const fixed = entry && fixedOf(entry)?.date === date && a.from && a.to;
    return {
      unitId: a.id,
      itemKey: a.itemKey,
      title: titles[a.itemKey] ?? a.itemKey,
      minutes: a.minutes,
      k: a.k,
      of: a.of,
      reason: a.reason,
      ...(a.bumpedBy ? { bumpedBy: a.bumpedBy } : {}),
      ...(a.late ? { late: true } : {}),
      approx:
        item?.durationMin === undefined &&
        entry?.durationMin === undefined &&
        a.minutes === DEFAULT_MIN,
      // „fest“: the lock lives on the row (planner rethink), no proposal takes the thing from this day.
      pinned: a.locked === true,
      // A deadline marked in the plan, or one the source holds as hard (an invoice, a cancellation).
      ...(item?.due?.hard ? dueOf(item.due, entry?.due) : entry?.due?.hard ? dueOf(entry.due) : {}),
      ...(entry ? { entry } : {}),
      ...(item ? { item } : {}),
      ...(fixed ? { fixed: { from: a.from!, to: a.to! } } : {}),
    };
  };
  // Where each thing lies (its rows, any day): a stored row always wins over a source's dated turn or ToDo date.
  const rowDates = new Map<string, string[]>();
  for (const a of input.assignments)
    rowDates.set(a.itemKey, [...(rowDates.get(a.itemKey) ?? []), a.date]);
  const lastDate = addDaysIso(input.today, input.span - 1);
  /** A source's dated turn (`day`) without a row, not fixed (a fixed block has its row), still open. */
  const turnDay = (key: string, e: PlannableEntry): string | undefined =>
    turnDayOf(e, {
      laid: rowDates.has(key),
      excluded: items.get(key)?.excluded === true,
      late: lateDue.has(key),
    });
  /** A date the person set in ToDos that the plan does not hold (`isPlannerOwned` false, no row on it). */
  const todoDay = (key: string, e: PlannableEntry): string | undefined =>
    e.plannedFor &&
    !e.done &&
    !isPlannerOwned(e) &&
    !(rowDates.get(key) ?? []).includes(e.plannedFor) &&
    !e.day &&
    !fixedOf(e) &&
    !lateDue.has(key) &&
    !items.get(key)?.excluded
      ? e.plannedFor
      : undefined;
  const turnRow = (key: string, e: PlannableEntry): BoardRow => {
    const item = items.get(key);
    const minutes = item?.durationMin ?? e.durationMin ?? DEFAULT_MIN;
    return {
      unitId: `${key}#0`,
      itemKey: key,
      title: e.title,
      minutes,
      k: 0,
      of: 1,
      reason: 'kept',
      approx: item?.durationMin === undefined && e.durationMin === undefined,
      pinned: false,
      ...(item?.due?.hard ? dueOf(item.due, e.due) : e.due?.hard ? dueOf(e.due) : {}),
      entry: e,
      ...(item ? { item } : {}),
      derived: true,
    };
  };
  const built = planDays({
    today: input.today,
    span: input.span,
    settings: input.settings,
    dayRows: input.dayRows,
    calendar: input.calendar,
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });
  const days: BoardDay[] = built.map(({ date, availableMin, blockers, row, window, ownWindow }) => {
    const cap = capacity({ date, availableMin, blockers }, { bufferShare });
    const rows: BoardRow[] = input.assignments
      .filter((a) => a.date === date && !lateDue.has(a.itemKey) && shown(a))
      .sort((a, b) => a.order - b.order)
      .map((a) => toRow(a, date));
    // A dated turn without a row stands on its day (`dayOf`), after the laid things.
    for (const [key, e] of entries) if (turnDay(key, e) === date) rows.push(turnRow(key, e));
    const hints: TodoHint[] = [...entries]
      .filter(([key, e]) => todoDay(key, e) === date)
      .map(([key, e]) => ({ itemKey: key, title: e.title, date, entry: e }))
      .sort(
        (a, b) => (a.entry.createdAt ?? 0) - (b.entry.createdAt ?? 0) || cmp(a.itemKey, b.itemKey),
      );
    // As the engine counts (`core/plan/engine.ts` rule 2b): a fixed block takes only what no timed blocker covers.
    const fixedRows = rows
      .filter((r) => r.fixed)
      .sort((a, b) => cmp(a.fixed!.from, b.fixed!.from) || cmp(a.unitId, b.unitId));
    const charges = fixedCharges(
      fixedRows.map((r) => ({ minutes: r.minutes, ...r.fixed })),
      blockers,
    );
    const planned =
      rows.filter((r) => !r.fixed).reduce((n, r) => n + r.minutes, 0) +
      charges.reduce((n, c) => n + c, 0);
    return {
      date,
      isToday: date === input.today,
      ...(row ? { row } : {}),
      availableMin,
      raw: cap.raw,
      usable: cap.usable,
      planned,
      free: Math.max(0, cap.usable - planned),
      over: Math.max(0, planned - cap.usable),
      off: availableMin === 0,
      defaultMin: defaultAvailable(input.settings, isoWeekday(date)),
      ...(window ? { window } : {}),
      ...(ownWindow ? { ownWindow: true } : {}),
      blockers,
      rows,
      hints,
    };
  });
  // Shown on a day of the board (a dated turn, a ToDo's own date): not „Noch ohne Tag“ as well.
  const onADay = new Set<string>();
  for (const [key, e] of entries) {
    const turn = turnDay(key, e);
    const todo = todoDay(key, e);
    if (
      (turn && turn >= input.today && turn <= lastDate) ||
      (todo && todo >= input.today && todo <= lastDate)
    )
      onADay.add(key);
  }
  const hardDueOf = (key: string): string | undefined => {
    const item = items.get(key);
    const entry = entries.get(key);
    return item?.due?.hard ? item.due.date : entry?.due?.hard ? entry.due.date : undefined;
  };
  const placed = new Set(input.assignments.map((a) => a.itemKey));
  const waiting: WaitingRow[] = input.unplaced
    .filter((u) => u.reason !== 'after-hard-due' || !placed.has(u.itemKey) || u.date === undefined)
    .filter((u) => entries.has(u.itemKey) && !lateDue.has(u.itemKey) && !onADay.has(u.itemKey))
    // A thing with a row is never „Noch ohne Tag“, whatever the last pass said.
    .filter((u) => u.reason !== 'no-day' || !rowDates.has(u.itemKey))
    .map((u) => ({
      unitId: u.id,
      itemKey: u.itemKey,
      title: titles[u.itemKey] ?? u.itemKey,
      minutes: u.minutes,
      k: u.k,
      of: u.of,
      reason: u.reason,
      ...(u.bumpedBy ? { bumpedBy: u.bumpedBy } : {}),
      ...(entries.get(u.itemKey) ? { entry: entries.get(u.itemKey) } : {}),
      ...(items.get(u.itemKey) ? { item: items.get(u.itemKey) } : {}),
      ...(hardDueOf(u.itemKey) ? { hardDue: hardDueOf(u.itemKey) } : {}),
      ...(todoDay(u.itemKey, entries.get(u.itemKey)!)
        ? { todoDate: todoDay(u.itemKey, entries.get(u.itemKey)!) }
        : {}),
    }));
  // „Nicht planen“: listed at the end of the waiting group, so „Wieder planen“ has a place.
  for (const [key, item] of items) {
    if (!item.excluded) continue;
    const entry = entries.get(key);
    if (!entry || entry.done) continue;
    waiting.push({
      unitId: `${key}#0`,
      itemKey: key,
      title: entry.title,
      minutes: item.durationMin ?? entry.durationMin ?? DEFAULT_MIN,
      k: 0,
      of: 1,
      reason: 'excluded',
      entry,
      item,
    });
  }
  // „Noch offen“ (planner rethink): what lies on a day that has passed and is not done. Nothing moved it – the
  // row is still on its day; things that are „fest“ come first (they need a new day), then by day.
  const open: OpenRow[] = input.assignments
    .filter((a) => a.date < input.today && !lateDue.has(a.itemKey) && shown(a))
    .filter(
      (a) =>
        !items.get(a.itemKey)?.excluded &&
        !(entries.get(a.itemKey) && fixedOf(entries.get(a.itemKey)!)),
    )
    .map((a) => ({ ...toRow(a, a.date), date: a.date }))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        a.date.localeCompare(b.date) ||
        a.unitId.localeCompare(b.unitId),
    );
  // A thing laid on a day the board does not show yet (beyond its last day) must not vanish: it is listed with the
  // things outside the days, saying where it lies.
  const lastShown = days.at(-1)?.date;
  if (lastShown) {
    // A thing in parts with a part on a shown day is seen there: it is not listed a second time.
    const seen = new Set<string>(days.flatMap((d) => d.rows.map((r) => r.itemKey)));
    for (const a of [...input.assignments].sort((x, y) => x.date.localeCompare(y.date))) {
      if (a.date <= lastShown || seen.has(a.itemKey) || lateDue.has(a.itemKey) || !shown(a))
        continue;
      const entry = entries.get(a.itemKey);
      if ((entry && fixedOf(entry)) || items.get(a.itemKey)?.excluded) continue;
      seen.add(a.itemKey);
      waiting.push({
        unitId: a.id,
        itemKey: a.itemKey,
        title: titles[a.itemKey] ?? a.itemKey,
        minutes: a.minutes,
        k: a.k,
        of: a.of,
        reason: 'later',
        date: a.date,
        ...(entry ? { entry } : {}),
        ...(items.get(a.itemKey) ? { item: items.get(a.itemKey) } : {}),
      });
    }
    // A dated turn on a day after the board's last one: listed with its day, like a laid thing.
    for (const [key, e] of entries) {
      const turn = turnDay(key, e);
      if (!turn || turn <= lastShown || seen.has(key)) continue;
      seen.add(key);
      const row = turnRow(key, e);
      waiting.push({
        unitId: row.unitId,
        itemKey: key,
        title: row.title,
        minutes: row.minutes,
        k: 0,
        of: 1,
        reason: 'later',
        date: turn,
        entry: e,
        ...(row.item ? { item: row.item } : {}),
      });
    }
  }
  // „Liegt weiter voraus“ in date order, laid things and dated turns together.
  const laterRows = waiting
    .filter((w) => w.reason === 'later')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.unitId.localeCompare(b.unitId));
  waiting.splice(0, waiting.length, ...waiting.filter((w) => w.reason !== 'later'), ...laterRows);
  const todayDay = days[0];
  const todayCount = todayDay ? new Set(todayDay.rows.map((r) => r.itemKey)).size : 0;
  return { days, waiting, late, open, todayCount };
}
