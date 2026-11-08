/**
 * Rough daily kcal need (docs/features/fitness.md §4): Mifflin-St Jeor resting rate × activity
 * factor, rounded to 50 kcal. Pure; the inputs are never stored (only the result becomes the goal).
 */
export const SEXES = ['male', 'female', 'none'] as const;
export type Sex = (typeof SEXES)[number];
export const ACTIVITY = ['sitting', 'light', 'moderate', 'active', 'veryActive'] as const;
export type Activity = (typeof ACTIVITY)[number];

const SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161, none: -78 };
export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sitting: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export interface GoalInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: Activity;
}

/** Bounds of the formula's inputs (adults); outside them there is no estimate. */
export const LIMITS = {
  weightKg: [30, 300],
  heightCm: [120, 230],
  age: [18, 99],
} as const;

const inside = (v: number, [lo, hi]: readonly [number, number]) =>
  Number.isFinite(v) && v >= lo && v <= hi;

/** The estimate in kcal per day, or `undefined` when an input is missing or out of range. */
export function estimateKcal(input: GoalInput): number | undefined {
  if (
    !inside(input.weightKg, LIMITS.weightKg) ||
    !inside(input.heightCm, LIMITS.heightCm) ||
    !inside(input.age, LIMITS.age)
  )
    return undefined;
  const rest = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + SEX_OFFSET[input.sex];
  return Math.round((rest * ACTIVITY_FACTOR[input.activity]) / 50) * 50;
}
