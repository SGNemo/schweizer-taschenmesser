import { z } from 'zod';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * Fitness (docs/features/fitness.md): a training log and a rough kcal log. No body data is ever
 * stored here (no weight, height, age): the kcal goal calculator keeps its inputs in the open dialog.
 */

/** One exercise of a session: sets × reps at a weight, or a duration (Laufen 30 Min). All optional. */
export const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.number().int().min(1).max(500).optional(),
  /** Kilograms, at most one decimal (62.5). */
  weightKg: z.number().min(0).max(1000).optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
});
export type Exercise = z.output<typeof exerciseSchema>;

/** A training session (Einheit) on one day. */
export const sessionSchema = z.object({
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE).optional(),
  /** "Oberkörper", "Laufen": optional, the exercises say the rest. */
  title: z.string().max(80).optional(),
  /** Total minutes of the session. */
  durationMin: z.number().int().min(1).max(1440).optional(),
  exercises: z.array(exerciseSchema).max(30).default([]),
  note: z.string().max(2000).optional(),
});
export type Session = z.output<typeof sessionSchema>;

/** A meal or snack: a short text and rough kcal; macros only behind "Erweitert". */
export const mealSchema = z.object({
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE).optional(),
  text: z.string().trim().min(1).max(120),
  kcal: z.number().int().min(0).max(9999),
  proteinG: z.number().int().min(0).max(999).optional(),
  carbsG: z.number().int().min(0).max(999).optional(),
  fatG: z.number().int().min(0).max(999).optional(),
});
export type Meal = z.output<typeof mealSchema>;
