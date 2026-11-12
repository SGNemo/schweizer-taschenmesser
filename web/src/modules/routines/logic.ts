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

/** The first due day of a new or edited routine: its first day, or the rule's next day once that has passed. */
export function firstDue(r: Pick<Routine, 'repeat' | 'startDate'>, today: string): string {
  return r.startDate >= today ? r.startDate : nextDue(r, addDaysStr(today, -1));
}

type TurnState = Pick<Routine, 'dueDate' | 'turn' | 'lastDoneOn' | 'lastDoneBy'>;

/** "Erledigt": the next day, the next name, and who did it when. */
export function donePatch(r: Routine, today: string): TurnState {
  return {
    dueDate: nextDue(r, today),
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
