import type { Stored } from '@/core/db/types';
import { compareText } from '@/core/i18n/format';
import { firstOnOrAfter, nextOccurrence, occurrencesBetween } from '@/core/recurrence/expand';
import type { Recurrence } from '@/core/recurrence/types';
import { addDaysStr } from '@/core/time/dates';
import type { Daypart, Routine, Step } from './schema';

/** A planned routine without a duration still takes some time in the plan. */
export const DEFAULT_MINUTES = 20;

/** It is someone's turn: the day has come. There is no "late": a routine waits, it never piles up. */
export const isDue = (r: Pick<Routine, 'dueDate'>, today: string): boolean => r.dueDate <= today;

/** Whose turn it is; undefined when no names are set. */
export function whoseTurn(r: Pick<Routine, 'people' | 'turn'>): string | undefined {
  return r.people.length ? r.people[r.turn % r.people.length] : undefined;
}

/** A routine never ends by its rule (it is deleted instead): an end date or a count is dropped. */
export function openEnded(rule: Recurrence): Recurrence {
  const { until: _until, count: _count, ...rest } = rule;
  return rest;
}

/**
 * The next day after `today` the rule names, counted from the routine's first day. Done late, the days that
 * passed are skipped: the routine comes round again at its usual rhythm, nothing is owed.
 */
export function nextDue(r: Pick<Routine, 'repeat' | 'startDate'>, today: string): string {
  return nextOccurrence(openEnded(r.repeat), r.startDate, today) ?? addDaysStr(today, 1);
}

/** A due day for seed data: the rule's first day, or its next day on or after `today` once that has passed. */
export function firstDue(r: Pick<Routine, 'repeat' | 'startDate'>, today: string): string {
  return r.startDate >= today ? r.startDate : nextDue(r, addDaysStr(today, -1));
}

type TurnState = Pick<Routine, 'dueDate' | 'turn' | 'lastDoneOn' | 'lastDoneBy'>;

/** "Erledigt": the next day, the next name, and who did it when. */
export function donePatch(r: Routine, today: string): TurnState {
  return {
    // Done before its day, the routine still moves a whole round on (the turn it was done for is over).
    dueDate: nextDue(r, r.dueDate > today ? r.dueDate : today),
    turn: r.people.length ? (r.turn + 1) % r.people.length : 0,
    lastDoneOn: today,
    lastDoneBy: whoseTurn(r),
  };
}

/** What `donePatch` replaced, to take it back. */
export const turnState = (r: Routine): TurnState => ({
  dueDate: r.dueDate,
  turn: r.turn,
  lastDoneOn: r.lastDoneOn,
  lastDoneBy: r.lastDoneBy,
});

/** Due ones first, then by day, then by time of day (morning first), then by name. */
export function sortRoutines<T extends Routine>(list: readonly T[], today: string): T[] {
  return [...list].sort(
    (a, b) =>
      Number(isDue(b, today)) - Number(isDue(a, today)) ||
      a.dueDate.localeCompare(b.dueDate) ||
      daypartRank(a) - daypartRank(b) ||
      compareText(a.name, b.name),
  );
}

/** Rooms in alphabetical order, routines without a room last (key `''`). */
export function groupByRoom<T extends Routine>(list: readonly T[]): { room: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of list) {
    const key = r.room?.trim() ?? '';
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : compareText(a, b)))
    .map(([room, items]) => ({ room, items }));
}

/** "Mia, Ben ,  " → ['Mia', 'Ben'] (no doubles, at most twelve). */
export function parsePeople(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const name = raw.trim().slice(0, 40);
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 12);
}

export type StoredRoutine = Stored<Routine>;

/** The steps of a routine; a row synced from a device before version 2 has none. */
export const stepsOf = (r: Pick<Routine, 'steps'>): Step[] => r.steps ?? [];

/** The ids of the steps ticked for the turn that is due now (a tick for another turn does not count). */
export function doneSteps(r: Pick<Routine, 'steps' | 'progress' | 'dueDate'>): Set<string> {
  if (!r.progress || r.progress.day !== r.dueDate) return new Set();
  const ids = new Set(stepsOf(r).map((s) => s.id));
  return new Set(r.progress.done.filter((id) => ids.has(id)));
}

/** A step ticked or unticked for the turn due now; the other steps keep their state. */
export function toggleStepPatch(
  r: Pick<Routine, 'steps' | 'progress' | 'dueDate'>,
  stepId: string,
  done: boolean,
): Pick<Routine, 'progress'> {
  const set = doneSteps(r);
  if (done) set.add(stepId);
  else set.delete(stepId);
  // In the order of the steps, so two devices that tick the same steps write the same value.
  return {
    progress: { day: r.dueDate, done: stepsOf(r).flatMap((s) => (set.has(s.id) ? [s.id] : [])) },
  };
}

/** Every step of the turn is ticked (a routine without steps never is). */
export function allStepsDone(r: Pick<Routine, 'steps' | 'progress' | 'dueDate'>): boolean {
  const steps = stepsOf(r);
  return steps.length > 0 && doneSteps(r).size === steps.length;
}

/**
 * The steps as typed (one per line) → steps. A line that is still there keeps its id (and so its tick), also
 * when only its capital letters changed or, with the same number of lines, its text was corrected in place; a new
 * line gets a new id from `newId`.
 */
export function parseSteps(text: string, existing: readonly Step[], newId: () => string): Step[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw
      .trim()
      .replace(/^[-–•*]\s*/, '')
      .slice(0, 200);
    if (line) lines.push(line);
    if (lines.length === 40) break;
  }
  const used = new Set<string>();
  const byText = lines.map((line) => {
    const hit = existing.find(
      (s) => !used.has(s.id) && s.text.toLocaleLowerCase() === line.toLocaleLowerCase(),
    );
    if (hit) used.add(hit.id);
    return hit?.id;
  });
  // Same number of lines: a line whose text changed is the step at its place (a corrected typo keeps its tick).
  const samePlaces = lines.length === existing.length;
  return lines.map((line, i) => {
    const atPlace = existing[i];
    const id =
      byText[i] ??
      (samePlaces && atPlace && !used.has(atPlace.id)
        ? (used.add(atPlace.id), atPlace.id)
        : newId());
    return { id, text: line };
  });
}

/** Steps → the text of the steps field (one per line). */
export const stepsText = (steps: readonly Step[]): string => steps.map((s) => s.text).join('\n');

/**
 * „Wie oft“ in plain words. `custom` is any other rule (every three days, the 15th of each month …): it keeps the
 * full rule editor behind „Mehr Felder“.
 */
export const RHYTHMS = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom'] as const;
export type Rhythm = (typeof RHYTHMS)[number];

/** Monday to Friday, the days a new „An Wochentagen“ routine starts with. */
export const WORKDAYS = [1, 2, 3, 4, 5];

/** The plain choice a rule matches; `custom` when it is none of them. */
export function rhythmOf(rule: Recurrence): Rhythm {
  const n = rule.interval ?? 1;
  const days = rule.byWeekday ?? [];
  if (rule.byMonthDay !== undefined || rule.monthOfYear !== undefined) return 'custom';
  if (rule.freq === 'daily' && n === 1) return 'daily';
  if (rule.freq === 'weekly' && n === 1 && days.length > 0) return 'weekdays';
  if (rule.freq === 'weekly' && days.length === 0)
    return n === 1 ? 'weekly' : n === 2 ? 'biweekly' : 'custom';
  if (rule.freq === 'monthly' && n === 1) return 'monthly';
  return 'custom';
}

/** The rule of a plain choice. `weekdays` keeps the days already chosen (Monday to Friday when there are none). */
export function ruleOf(
  rhythm: Exclude<Rhythm, 'custom'>,
  days: readonly number[] = [],
): Recurrence {
  switch (rhythm) {
    case 'daily':
      return { freq: 'daily', interval: 1 };
    case 'weekdays':
      return { freq: 'weekly', interval: 1, byWeekday: days.length ? [...days] : [...WORKDAYS] };
    case 'weekly':
      return { freq: 'weekly', interval: 1 };
    case 'biweekly':
      return { freq: 'weekly', interval: 2 };
    case 'monthly':
      return { freq: 'monthly', interval: 1 };
  }
}

/** Morning before midday before evening before „any time“: the order the day is lived in. */
const DAYPART_ORDER: Record<Daypart | 'none', number> = {
  morning: 0,
  midday: 1,
  evening: 2,
  none: 3,
};
const daypartRank = (r: Pick<Routine, 'daypart'>) => DAYPART_ORDER[r.daypart ?? 'none'];

/** What the editor holds when "Speichern" is pressed. */
export interface RoutineForm {
  name: string;
  room: string;
  repeat: Recurrence;
  /** The names field as typed. */
  people: string;
  /** "Nächstes Mal" (`YYYY-MM-DD`). */
  dueDate: string;
  minutes?: number;
  note: string;
  /** The steps, already parsed (`parseSteps`); left out = none for a new routine, unchanged for an edit. */
  steps?: Step[];
  daypart?: Daypart;
  /** `HH:mm` or empty = no reminder; left out = unchanged for an edit. */
  remindAt?: string;
  /** „Im Planer zeigen“; left out = yes for a new routine, unchanged for an edit. */
  planner?: boolean;
}

/** The rule as a comparable text: its fields in a fixed order, weekdays sorted, nothing for "not set". */
const ruleKey = (r: Recurrence): string =>
  [
    r.freq,
    r.interval ?? 1,
    [...(r.byWeekday ?? [])].sort((a, b) => a - b).join(','),
    r.byMonthDay ?? '',
    r.monthOfYear ?? '',
  ].join('|');

const sameRule = (a: Recurrence, b: Recurrence): boolean => ruleKey(a) === ruleKey(b);

/**
 * A new routine: due on the day the user set (a day in the past is simply due now), the rule counts from it. A
 * rule with weekdays starts on the first of them on or after that day („Wochenputz“ on Saturday is not due on a
 * Tuesday).
 */
export function newRoutine(form: RoutineForm): Routine {
  const repeat = openEnded(form.repeat);
  const first = repeat.byWeekday?.length
    ? (firstOnOrAfter(repeat, form.dueDate, form.dueDate) ?? form.dueDate)
    : form.dueDate;
  return {
    name: form.name.trim(),
    room: form.room.trim() || undefined,
    repeat,
    startDate: first,
    dueDate: first,
    people: parsePeople(form.people),
    turn: 0,
    minutes: form.minutes,
    note: form.note.trim() || undefined,
    steps: form.steps ?? [],
    daypart: form.daypart,
    remindAt: form.remindAt || undefined,
    // Stored only when switched off: a routine without the field is offered to the planner.
    planner: form.planner === false ? false : undefined,
  };
}

/**
 * The fields an edit really changed. A routine that is due stays due when only its name or room is corrected,
 * and whatever happened to it while the dialog was open (a tick in the widget, in the plan, on another device)
 * is not written back: day, anchor and turn are only touched when the user changed them here.
 */
export function editPatch(
  existing: Routine,
  form: RoutineForm,
  /** The row as it is stored right now (it may have been ticked since the dialog opened). */
  live: Pick<Routine, 'people' | 'turn'> = existing,
): Partial<Routine> {
  const patch: Partial<Routine> = {};
  const name = form.name.trim();
  if (name !== existing.name) patch.name = name;
  const room = form.room.trim() || undefined;
  if (room !== existing.room) patch.room = room;
  const ruleChanged = !sameRule(form.repeat, existing.repeat);
  if (ruleChanged) patch.repeat = openEnded(form.repeat);
  if (form.dueDate !== existing.dueDate) {
    // The day the user typed, as it is; the rule counts from it.
    patch.dueDate = form.dueDate;
    patch.startDate = form.dueDate;
  } else if (ruleChanged) {
    // A new rhythm counts from the day the routine is due next; with weekdays, from the first of them on or after
    // it (a routine moved to „Samstag“ is not due on the Tuesday it was due before).
    const rule = openEnded(form.repeat);
    const first = rule.byWeekday?.length
      ? (firstOnOrAfter(rule, existing.dueDate, existing.dueDate) ?? existing.dueDate)
      : existing.dueDate;
    patch.startDate = first;
    if (first !== existing.dueDate) patch.dueDate = first;
  }
  const people = parsePeople(form.people);
  if (people.join('\n') !== existing.people.join('\n')) {
    patch.people = people;
    // Whoever is next right now stays next while their name is still there (a corrected capital letter counts as the same name).
    const next = whoseTurn(live)?.toLocaleLowerCase();
    patch.turn = Math.max(
      0,
      people.findIndex((p) => p.toLocaleLowerCase() === next),
    );
  }
  if (form.minutes !== existing.minutes) patch.minutes = form.minutes;
  const note = form.note.trim() || undefined;
  if (note !== existing.note) patch.note = note;
  if (form.steps) {
    const before = stepsOf(existing);
    const same =
      form.steps.length === before.length &&
      form.steps.every((s, i) => s.id === before[i]!.id && s.text === before[i]!.text);
    if (!same) patch.steps = form.steps;
  }
  if ('remindAt' in form && (form.remindAt || undefined) !== existing.remindAt)
    patch.remindAt = form.remindAt || undefined;
  if (form.planner !== undefined && form.planner !== (existing.planner !== false))
    patch.planner = form.planner ? undefined : false;
  // An edit that leaves the time of day out (older callers, tests) keeps it.
  if ('daypart' in form && form.daypart !== existing.daypart) patch.daypart = form.daypart;
  return patch;
}

/**
 * The days in [from, to] a routine's reminder is for: the day its turn is due and the rule's days after it while
 * the turn waits. A turn that is done moves `dueDate` on, so days before it are never reminded of; a routine that
 * waits is reminded once on each of its own days, never on the days in between.
 */
export function reminderDays(
  r: Pick<Routine, 'repeat' | 'startDate' | 'dueDate'>,
  from: string,
  to: string,
): string[] {
  // Not due in the window: nothing to walk (most routines on most collects).
  if (r.dueDate > to) return [];
  const start = r.dueDate > from ? r.dueDate : from;
  const days = new Set(occurrencesBetween(openEnded(r.repeat), r.startDate, start, to));
  if (r.dueDate >= from && r.dueDate <= to) days.add(r.dueDate);
  return [...days].sort();
}
