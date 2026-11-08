import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

/** `kcalGoal` and `weekSessions`: 0 = no goal (then the widget only counts). Never computed by itself. */
export const settingsSchema = z.object({
  nutrition: z.boolean(),
  kcalGoal: z.number().int().min(0).max(9999),
  weekSessions: z.number().int().min(0).max(21),
});
export type FitnessSettings = z.output<typeof settingsSchema>;

export const DEFAULTS: FitnessSettings = { nutrition: true, kcalGoal: 0, weekSessions: 0 };

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: DEFAULTS,
  keywords: ['training', 'kalorien', 'kcal', 'sport', 'essen'],
  fields: [
    {
      key: 'nutrition',
      get label() {
        return t.fitness.meta.settings.nutrition;
      },
      get help() {
        return t.fitness.meta.settings.nutritionHelp;
      },
      type: 'boolean',
    },
    {
      key: 'kcalGoal',
      get label() {
        return t.fitness.meta.settings.kcalGoal;
      },
      get help() {
        return t.fitness.meta.settings.kcalGoalHelp;
      },
      type: 'number',
    },
    {
      key: 'weekSessions',
      get label() {
        return t.fitness.meta.settings.weekSessions;
      },
      get help() {
        return t.fitness.meta.settings.weekSessionsHelp;
      },
      type: 'number',
    },
  ],
};
