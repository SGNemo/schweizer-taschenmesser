import type { Recurrence } from '@/core/recurrence/types';

/**
 * Start templates: typical household routines the user ticks in the start-data wizard. Names and rooms are
 * texts (`t.onboarding.routines.items`); rhythm, first day and duration live here.
 */
export interface RoutineTemplate {
  repeat: Recurrence;
  /**
   * Days from today to the first time. Never 0, and no two templates share it: taking several must not open
   * the page with a row of "dran" (FOCUS: stimulus load).
   */
  firstIn: number;
  minutes: number;
}

const weekly = (interval = 1): Recurrence => ({ freq: 'weekly', interval });
const monthly = (interval = 1): Recurrence => ({ freq: 'monthly', interval });

export const ROUTINE_TEMPLATES = {
  bath: { repeat: weekly(), firstIn: 1, minutes: 30 },
  vacuum: { repeat: weekly(), firstIn: 2, minutes: 20 },
  kitchen: { repeat: weekly(), firstIn: 3, minutes: 20 },
  laundry: { repeat: weekly(), firstIn: 4, minutes: 15 },
  plants: { repeat: weekly(), firstIn: 5, minutes: 10 },
  floors: { repeat: weekly(2), firstIn: 6, minutes: 30 },
  bedding: { repeat: weekly(2), firstIn: 8, minutes: 15 },
  dust: { repeat: weekly(2), firstIn: 10, minutes: 20 },
  fridge: { repeat: monthly(), firstIn: 14, minutes: 20 },
  windows: { repeat: monthly(3), firstIn: 21, minutes: 60 },
} as const satisfies Record<string, RoutineTemplate>;

export type RoutineTemplateId = keyof typeof ROUTINE_TEMPLATES;
export const ROUTINE_TEMPLATE_IDS = Object.keys(ROUTINE_TEMPLATES) as RoutineTemplateId[];
