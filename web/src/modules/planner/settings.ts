import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import type { PlanSettings } from '@/core/plan/types';
import { formatMinutes } from '@/core/i18n/format';
import { t } from '@/strings';

export const PLANNER_SCOPE = 'module.planner';

/** Select fields store their value as a string (`pages/settings/ModuleSection`); `planSettings` turns them into numbers. */
export const BUFFER_SHARES = ['0', '10', '20', '30'] as const;
export const HORIZONS = ['7', '14', '28'] as const;
export const MAX_SESSIONS = ['45', '60', '90', '120'] as const;

/**
 * Synced module settings (CONCEPT §2). This file is loaded with the manifest, so it imports no
 * database code; `prefs.ts` reads the stored values. The number of main items per day reuses `focus.planLimit`
 * (no second setting). `calendarChips` (one plan chip per day in the calendar, `calendar.ts`) is read since package 2,
 * `overloadToast` (one toast line when the overflow first goes above zero, at most once per ISO week, `overload.ts`) since package 3.
 */
export const plannerSettingsSchema = z.object({
  availableWeekday: z.number().int().min(0).max(1440),
  availableSaturday: z.number().int().min(0).max(1440),
  availableSunday: z.number().int().min(0).max(1440),
  /** Percent of the free time never planned. */
  bufferShare: z.enum(BUFFER_SHARES),
  horizonDays: z.enum(HORIZONS),
  maxSessionMin: z.enum(MAX_SESSIONS),
  minSessionMin: z.number().int().min(5).max(240),
  autoReplan: z.boolean(),
  calendarBlocks: z.boolean(),
  allDayBlocks: z.boolean(),
  calendarChips: z.boolean(),
  overloadToast: z.boolean(),
});
export type PlannerSettings = z.output<typeof plannerSettingsSchema>;

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  availableWeekday: 240,
  availableSaturday: 120,
  availableSunday: 0,
  bufferShare: '20',
  horizonDays: '14',
  maxSessionMin: '90',
  minSessionMin: 25,
  autoReplan: true,
  calendarBlocks: true,
  allDayBlocks: false,
  calendarChips: true,
  overloadToast: true,
};

/** Minutes available on a date by its weekday (Monday = 1 … Sunday = 7) when no day row says otherwise. */
export function defaultAvailable(settings: PlannerSettings, isoWeekday: number): number {
  if (isoWeekday === 6) return settings.availableSaturday;
  if (isoWeekday === 7) return settings.availableSunday;
  return settings.availableWeekday;
}

/** The engine's settings from the module settings plus `focus.planLimit`. */
export function planSettings(settings: PlannerSettings, planLimit: number): PlanSettings {
  return {
    bufferShare: Number(settings.bufferShare) / 100,
    horizonDays: Number(settings.horizonDays),
    maxSessionMin: Number(settings.maxSessionMin),
    minSessionMin: settings.minSessionMin,
    mainPerDay: planLimit,
  };
}

const s = () => t.planner.meta.settings;

export const settings: ModuleSettings = {
  schema: plannerSettingsSchema,
  defaults: DEFAULT_PLANNER_SETTINGS,
  fields: [
    {
      key: 'availableWeekday',
      type: 'number',
      get label() {
        return s().availableWeekday;
      },
      get help() {
        return s().availableWeekdayHelp;
      },
    },
    {
      key: 'availableSaturday',
      type: 'number',
      get label() {
        return s().availableSaturday;
      },
      get help() {
        return s().availableSaturdayHelp;
      },
    },
    {
      key: 'availableSunday',
      type: 'number',
      get label() {
        return s().availableSunday;
      },
      get help() {
        return s().availableSundayHelp;
      },
    },
    {
      key: 'bufferShare',
      type: 'select',
      level: 'advanced',
      get label() {
        return s().bufferShare;
      },
      get help() {
        return s().bufferShareHelp;
      },
      get options() {
        return BUFFER_SHARES.map((pct) => ({ value: pct, label: s().bufferOption(Number(pct)) }));
      },
    },
    {
      key: 'horizonDays',
      type: 'select',
      level: 'advanced',
      get label() {
        return s().horizonDays;
      },
      get help() {
        return s().horizonDaysHelp;
      },
      get options() {
        return HORIZONS.map((d) => ({ value: d, label: s().horizonOption(Number(d)) }));
      },
    },
    {
      key: 'maxSessionMin',
      type: 'select',
      level: 'advanced',
      get label() {
        return s().maxSessionMin;
      },
      get help() {
        return s().maxSessionMinHelp;
      },
      get options() {
        return MAX_SESSIONS.map((m) => ({
          value: m,
          label: formatMinutes(Number(m), { compact: true }),
        }));
      },
    },
    {
      key: 'minSessionMin',
      type: 'number',
      level: 'advanced',
      get label() {
        return s().minSessionMin;
      },
      get help() {
        return s().minSessionMinHelp;
      },
    },
    {
      key: 'autoReplan',
      type: 'boolean',
      get label() {
        return s().autoReplan;
      },
      get help() {
        return s().autoReplanHelp;
      },
    },
    {
      key: 'calendarBlocks',
      type: 'boolean',
      get label() {
        return s().calendarBlocks;
      },
      get help() {
        return s().calendarBlocksHelp;
      },
    },
    {
      key: 'calendarChips',
      type: 'boolean',
      get label() {
        return s().calendarChips;
      },
      get help() {
        return s().calendarChipsHelp;
      },
    },
    {
      key: 'overloadToast',
      type: 'boolean',
      get label() {
        return s().overloadToast;
      },
      get help() {
        return s().overloadToastHelp;
      },
    },
    {
      key: 'allDayBlocks',
      type: 'boolean',
      level: 'advanced',
      get label() {
        return s().allDayBlocks;
      },
      get help() {
        return s().allDayBlocksHelp;
      },
    },
  ],
};
