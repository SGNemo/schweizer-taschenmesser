/**
 * Training plan (deep package 3): templates carry weekdays („Oberkörper: Mo, Do“). A plan day is
 * derived, never stored: it shows as „Heute laut Plan“, in the week ahead and in the planner, and only
 * becomes a session when the user starts or ticks it. A day that already has a session shows no plan
 * day, and a passed plan day simply disappears (never „verpasst“). Pure functions, no clock.
 */
import { addDaysStr, parseDate } from '@/core/time/dates';
import { t } from '@/strings';
import { catalogName, type CatalogId } from './catalog';
import type { Session, Template } from './schema';

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = parseDate(date).getDay();
  return d === 0 ? 7 : d;
}

/** The weekdays in display order for the user's week start. */
export const weekdayOrder = (weekStart: 1 | 7): number[] =>
  weekStart === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];

/** One template due on one day. */
export interface PlanDay<T extends Template = Template> {
  date: string;
  template: T;
}

/**
 * The plan days `from`…`until` (inclusive): every template whose weekdays hold the day, unless that day
 * already has a session (logged or planned) – then the plan is met or replaced by the user's own.
 */
export function planDays<T extends Template>(
  templates: readonly T[],
  sessions: readonly Pick<Session, 'date'>[],
  from: string,
  until: string,
): PlanDay<T>[] {
  const taken = new Set(sessions.map((s) => s.date));
  const out: PlanDay<T>[] = [];
  for (let date = from; date <= until; date = addDaysStr(date, 1)) {
    if (taken.has(date)) continue;
    const wd = isoWeekday(date);
    for (const template of templates)
      if (template.weekdays?.includes(wd)) out.push({ date, template });
  }
  return out;
}

/** A plan day as a logged session (ticked off in the planner): the template's exercises, on `day`. */
export function sessionFromTemplate(tpl: Template, day: string): Session {
  return {
    date: day,
    title: tpl.title,
    exercises: tpl.exercises.map((e) => ({ ...e })),
    ...(tpl.durationMin ? { durationMin: tpl.durationMin } : {}),
  };
}

/** Item id of a plan day in the planner: `plan:<templateId>:<date>`. */
export const planItemId = (templateId: string, date: string) => `plan:${templateId}:${date}`;
export function parsePlanItemId(id: string): { templateId: string; date: string } | undefined {
  const m = /^plan:(.+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m ? { templateId: m[1]!, date: m[2]! } : undefined;
}

type PresetLine = { id: CatalogId; sets?: number; reps?: number; min?: number };
type PresetDay = {
  key: 'fullA' | 'fullB' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';
  weekdays: number[];
  durationMin: number;
  lines: PresetLine[];
};

/** Three common splits: start values without weights (the first session fills them in). */
export const PRESETS = {
  full2: [
    {
      key: 'fullA',
      weekdays: [1],
      durationMin: 50,
      lines: [
        { id: 'squat', sets: 3, reps: 8 },
        { id: 'benchPress', sets: 3, reps: 8 },
        { id: 'row', sets: 3, reps: 10 },
        { id: 'plank', sets: 3, min: 1 },
      ],
    },
    {
      key: 'fullB',
      weekdays: [4],
      durationMin: 50,
      lines: [
        { id: 'deadlift', sets: 3, reps: 5 },
        { id: 'shoulderPress', sets: 3, reps: 10 },
        { id: 'latPulldown', sets: 3, reps: 10 },
        { id: 'lunge', sets: 3, reps: 10 },
      ],
    },
  ],
  upperLower4: [
    {
      key: 'upper',
      weekdays: [1, 4],
      durationMin: 55,
      lines: [
        { id: 'benchPress', sets: 4, reps: 8 },
        { id: 'row', sets: 4, reps: 10 },
        { id: 'shoulderPress', sets: 3, reps: 10 },
        { id: 'latPulldown', sets: 3, reps: 10 },
        { id: 'bicepsCurl', sets: 3, reps: 12 },
      ],
    },
    {
      key: 'lower',
      weekdays: [2, 5],
      durationMin: 50,
      lines: [
        { id: 'squat', sets: 4, reps: 6 },
        { id: 'romanianDeadlift', sets: 3, reps: 8 },
        { id: 'lunge', sets: 3, reps: 10 },
        { id: 'calfRaise', sets: 3, reps: 15 },
      ],
    },
  ],
  ppl3: [
    {
      key: 'push',
      weekdays: [1],
      durationMin: 50,
      lines: [
        { id: 'benchPress', sets: 4, reps: 8 },
        { id: 'shoulderPress', sets: 3, reps: 10 },
        { id: 'dips', sets: 3, reps: 10 },
        { id: 'tricepsExtension', sets: 3, reps: 12 },
      ],
    },
    {
      key: 'pull',
      weekdays: [3],
      durationMin: 50,
      lines: [
        { id: 'pullUp', sets: 4, reps: 6 },
        { id: 'row', sets: 4, reps: 10 },
        { id: 'facePull', sets: 3, reps: 15 },
        { id: 'bicepsCurl', sets: 3, reps: 12 },
      ],
    },
    {
      key: 'legs',
      weekdays: [5],
      durationMin: 50,
      lines: [
        { id: 'squat', sets: 4, reps: 6 },
        { id: 'romanianDeadlift', sets: 3, reps: 8 },
        { id: 'legPress', sets: 3, reps: 10 },
        { id: 'calfRaise', sets: 3, reps: 15 },
      ],
    },
  ],
} as const satisfies Record<string, readonly PresetDay[]>;
export type PresetId = keyof typeof PRESETS;

/** A preset's templates in the UI language. */
export function presetTemplates(id: PresetId): Template[] {
  return PRESETS[id].map((d) => ({
    title: t.fitness.plan.days[d.key],
    durationMin: d.durationMin,
    weekdays: [...d.weekdays],
    exercises: d.lines.map((l: PresetLine) => ({
      name: catalogName(l.id),
      ...(l.sets ? { sets: l.sets } : {}),
      ...(l.reps ? { reps: l.reps } : {}),
      ...(l.min ? { durationMin: l.min } : {}),
    })),
  }));
}
