import type { Recurrence } from '@/core/recurrence/types';
import type { Daypart } from './schema';

/**
 * The starts offered when a routine is set up („Womit anfangen?“): a filled form, nothing is saved before
 * „Speichern“. Name and steps are texts (`t.routines.starts`); rhythm, time of day and duration live here.
 */
export interface RoutineStart {
  repeat: Recurrence;
  daypart?: Daypart;
  minutes: number;
  /** Offered to the planner. A daily routine of the day is not: it would fill every plan with the same row. */
  planner: boolean;
}

const weeklyOn = (day: number): Recurrence => ({ freq: 'weekly', interval: 1, byWeekday: [day] });
const daily: Recurrence = { freq: 'daily', interval: 1 };

export type RoutineStartId = 'morning' | 'evening' | 'weekClean' | 'weekShop';

export const ROUTINE_STARTS: Record<RoutineStartId, RoutineStart> = {
  morning: { repeat: daily, daypart: 'morning', minutes: 30, planner: false },
  evening: { repeat: daily, daypart: 'evening', minutes: 20, planner: false },
  // Saturday and Friday: a weekly routine with its day named reads as a plan, not as a chore that is due now.
  weekClean: { repeat: weeklyOn(6), minutes: 90, planner: true },
  weekShop: { repeat: weeklyOn(5), minutes: 60, planner: true },
};

export const ROUTINE_START_IDS: readonly RoutineStartId[] = [
  'morning',
  'evening',
  'weekClean',
  'weekShop',
];

export const isStartId = (id: string | null): id is RoutineStartId =>
  !!id && Object.hasOwn(ROUTINE_STARTS, id);
