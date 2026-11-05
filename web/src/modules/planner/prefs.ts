import { getSettings } from '@/core/settings/settings';
import {
  DEFAULT_PLANNER_SETTINGS,
  PLANNER_SCOPE,
  plannerSettingsSchema,
  type PlannerSettings,
} from './settings';

/** The stored module settings (defaults while nothing was saved). Kept apart from `settings.ts`, which the manifest loads eagerly. */
export const getPlannerSettings = (): Promise<PlannerSettings> =>
  getSettings(PLANNER_SCOPE, plannerSettingsSchema, DEFAULT_PLANNER_SETTINGS);
