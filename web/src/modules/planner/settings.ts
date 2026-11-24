import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import type { PlanSettings } from '@/core/plan/types';
import { parseTime, parseWindow, windowText, type TimeWindow } from '@/core/plan/windows';
import { formatMinutes } from '@/core/i18n/format';
import { t } from '@/strings';

export const PLANNER_SCOPE = 'module.planner';

/** Select fields store their value as a string (`pages/settings/ModuleSection`); `planSettings` turns them into numbers. */
export const BUFFER_SHARES = ['0', '10', '20', '30'] as const;
export const HORIZONS = ['7', '14', '28'] as const;
export const MAX_SESSIONS = ['45', '60', '90', '120'] as const;

/** A window setting: '9-17' reads back as '09:00–17:00'; anything else stays as typed (and is no window). */
const windowField = () =>
  z
    .string()
    .max(40)
    .transform((v) => {
      const w = parseWindow(v);
      return w ? windowText(w) : v.trim();
    })
    .catch('');

/** The „Tagesende“ as typed: '23', '23.00' read back as '23:00'; anything else stays as typed (and is no day end). */
const timeField = () =>
  z
    .string()
    .max(20)
    .transform((v) => parseTime(v) ?? v.trim())
    .catch('');

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
  /**
   * The weekday's time window as typed ('09:00–17:00', '9-17'; '' = none, package 5). Read through
   * `defaultWindow`; a readable one is shown in its written form, an unreadable text is no window and
   * never fails the other settings (`catch`).
   */
  windowWeekday: windowField(),
  windowSaturday: windowField(),
  windowSunday: windowField(),
  /** Percent of the free time never planned. */
  bufferShare: z.enum(BUFFER_SHARES),
  horizonDays: z.enum(HORIZONS),
  maxSessionMin: z.enum(MAX_SESSIONS),
  minSessionMin: z.number().int().min(5).max(240),
  /**
   * No longer read and no longer shown (planner rethink): nothing is planned by itself any more. The key stays, and
   * the one-time step writes `false` (`migrateModel.ts`), so a device still on the old version stops its
   * background runs.
   */
  autoReplan: z.boolean(),
  /**
   * „Neues automatisch vorschlagen“ (package 6, its own key – CONCEPT-MIGRATION §5): things without a deadline also
   * get a chip „Vorschlag: Do“, proposed after every deadline thing. A chip is never written; nothing moves by it.
   * A stored row of an older version has no such key: the defaults below are merged under it.
   */
  suggestNew: z.boolean(),
  calendarBlocks: z.boolean(),
  allDayBlocks: z.boolean(),
  calendarChips: z.boolean(),
  overloadToast: z.boolean(),
  /**
   * „Tagesende“ ('HH:mm', '' = none, package 6), the same for every day. It only gives the head its one calm line
   * „Bald ist Tagesende.“ from 30 minutes before (`rest.ts`, under `focus.eveningWrapUp`); the engine never reads
   * it – how much lands on a day stays the day's minutes, and no session is timed after the window's end.
   */
  dayEnd: timeField(),
  /**
   * „Zeilen aufklappen“ (planner hub 2, package 4a; COPY X15): a tap on a row's title opens its compartment with the
   * thing's panel; off, the title opens the thing in its module as before. Read by the planner page only.
   */
  expandRows: z.boolean(),
});
export type PlannerSettings = z.output<typeof plannerSettingsSchema>;

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  availableWeekday: 240,
  availableSaturday: 120,
  availableSunday: 0,
  windowWeekday: '',
  windowSaturday: '',
  windowSunday: '',
  bufferShare: '20',
  horizonDays: '14',
  maxSessionMin: '90',
  minSessionMin: 25,
  autoReplan: true,
  suggestNew: false,
  calendarBlocks: true,
  allDayBlocks: false,
  calendarChips: true,
  overloadToast: true,
  dayEnd: '',
  expandRows: true,
};

/** The day end of the settings as 'HH:mm'; `undefined` = none (empty or not readable). */
export const dayEndOf = (settings: Pick<PlannerSettings, 'dayEnd'>): string | undefined =>
  settings.dayEnd ? parseTime(settings.dayEnd) : undefined;

/** A day end as the planner writes it: '23:00', '0:00' (without a leading zero). */
export const dayEndLabel = (hhmm: string): string => hhmm.replace(/^0(\d)/, '$1');

/** Minutes available on a date by its weekday (Monday = 1 … Sunday = 7) when no day row says otherwise. */
export function defaultAvailable(settings: PlannerSettings, isoWeekday: number): number {
  if (isoWeekday === 6) return settings.availableSaturday;
  if (isoWeekday === 7) return settings.availableSunday;
  return settings.availableWeekday;
}

/** The time window of a weekday (Monday = 1 … Sunday = 7) when no day row has its own; `undefined` = none. */
export function defaultWindow(
  settings: PlannerSettings,
  isoWeekday: number,
): TimeWindow | undefined {
  return parseWindow(
    isoWeekday === 6
      ? settings.windowSaturday
      : isoWeekday === 7
        ? settings.windowSunday
        : settings.windowWeekday,
  );
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
      key: 'windowWeekday',
      type: 'text',
      get label() {
        return s().windowWeekday;
      },
      get help() {
        return s().windowWeekdayHelp;
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
      key: 'windowSaturday',
      type: 'text',
      get label() {
        return s().windowSaturday;
      },
      get help() {
        return s().windowSaturdayHelp;
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
      key: 'windowSunday',
      type: 'text',
      get label() {
        return s().windowSunday;
      },
      get help() {
        return s().windowSundayHelp;
      },
    },
    {
      key: 'dayEnd',
      type: 'text',
      get label() {
        return s().dayEnd;
      },
      get help() {
        return s().dayEndHelp;
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
      key: 'expandRows',
      type: 'boolean',
      get label() {
        return s().expandRows;
      },
      get help() {
        return s().expandRowsHelp;
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
      key: 'suggestNew',
      type: 'boolean',
      get label() {
        return s().suggestNew;
      },
      get help() {
        return s().suggestNewHelp;
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
