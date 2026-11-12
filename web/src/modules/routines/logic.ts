import type { Stored } from '@/core/db/types';
import { compareText } from '@/core/i18n/format';
import { nextOccurrence } from '@/core/recurrence/expand';
import type { Recurrence } from '@/core/recurrence/types';
import { addDaysStr } from '@/core/time/dates';
import type { Routine } from './schema';

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

/** Due ones first, then by day, then by name. */
export function sortRoutines<T extends Routine>(list: readonly T[], today: string): T[] {
  return [...list].sort(
    (a, b) =>
      Number(isDue(b, today)) - Number(isDue(a, today)) ||
      a.dueDate.localeCompare(b.dueDate) ||
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
}

const sameRule = (a: Recurrence, b: Recurrence): boolean =>
  JSON.stringify(openEnded(a)) === JSON.stringify(openEnded(b));

/** A new routine: due on the day the user set (a day in the past is simply due now), the rule counts from it. */
export function newRoutine(form: RoutineForm): Routine {
  return {
    name: form.name.trim(),
    room: form.room.trim() || undefined,
    repeat: openEnded(form.repeat),
    startDate: form.dueDate,
    dueDate: form.dueDate,
    people: parsePeople(form.people),
    turn: 0,
    minutes: form.minutes,
    note: form.note.trim() || undefined,
  };
}

/**
 * The fields an edit really changed. A routine that is due stays due when only its name or room is corrected,
 * and whatever happened to it while the dialog was open (a tick in the widget, in the plan, on another device)
 * is not written back: day, anchor and turn are only touched when the user changed them here.
 */
export function editPatch(existing: Routine, form: RoutineForm): Partial<Routine> {
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
    // A new rhythm counts from the day the routine is due next.
    patch.startDate = existing.dueDate;
  }
  const people = parsePeople(form.people);
  if (people.join('\n') !== existing.people.join('\n')) {
    patch.people = people;
    // Whoever was next stays next while their name is still there.
    patch.turn = Math.max(0, people.indexOf(whoseTurn(existing) ?? ''));
  }
  if (form.minutes !== existing.minutes) patch.minutes = form.minutes;
  const note = form.note.trim() || undefined;
  if (note !== existing.note) patch.note = note;
  return patch;
}
