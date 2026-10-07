import { addDaysStr, isoWeekday, pad2 } from '@/core/time/dates';
import { describeRecurrence } from '@/core/recurrence/describe';
import type { Recurrence } from '@/core/recurrence/types';
import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImportInput, ImportParseResult } from '@/core/importer/types';
import { t } from '@/strings';

/** Reminders are told apart from events by title only (the date moves on). */
export const reminderKey = (title: string) => `reminder|${title.trim().toLowerCase()}`;

/** The next date on or after `today` that is day `day` of `month` (any month when omitted). */
export function nextDayOfMonth(today: string, day: number, month?: number): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  for (let offset = 0; offset < 36; offset++) {
    const total = y * 12 + (m - 1) + offset;
    const year = Math.floor(total / 12);
    const mon = (total % 12) + 1;
    if (month !== undefined && mon !== month) continue;
    const candidate = `${year}-${pad2(mon)}-${pad2(day)}`;
    if (candidate >= today) return candidate;
  }
  return today;
}

/** The next given ISO weekday on or after `today`. */
export function nextWeekday(today: string, weekday: number): string {
  const diff = (weekday - isoWeekday(today) + 7) % 7;
  return addDaysStr(today, diff);
}

interface Template {
  title: string;
  time: string;
  recurrence: Recurrence;
  start: (today: string) => string;
}

const monthly = (interval = 1, byMonthDay = 1): Recurrence => ({
  freq: 'monthly',
  interval,
  byMonthDay,
});
const yearly = (monthOfYear: number): Recurrence => ({ freq: 'yearly', interval: 1, monthOfYear });

const TEMPLATES: Record<string, Template> = {
  rent: {
    get title() {
      return t.onboarding.reminders.rent[0];
    },
    time: '08:00',
    recurrence: monthly(),
    start: (today) => nextDayOfMonth(today, 1),
  },
  statements: {
    get title() {
      return t.onboarding.reminders.statements[0];
    },
    time: '09:00',
    recurrence: monthly(),
    start: (today) => nextDayOfMonth(today, 1),
  },
  trash: {
    get title() {
      return t.onboarding.reminders.trash[0];
    },
    time: '19:00',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [7] },
    start: (today) => nextWeekday(today, 7),
  },
  insurance: {
    get title() {
      return t.onboarding.reminders.insurance[0];
    },
    time: '09:00',
    recurrence: yearly(11),
    start: (today) => nextDayOfMonth(today, 1, 11),
  },
  energy: {
    get title() {
      return t.onboarding.reminders.energy[0];
    },
    time: '09:00',
    recurrence: yearly(9),
    start: (today) => nextDayOfMonth(today, 1, 9),
  },
  tax: {
    get title() {
      return t.onboarding.reminders.tax[0];
    },
    time: '09:00',
    recurrence: yearly(6),
    start: (today) => nextDayOfMonth(today, 1, 6),
  },
  dentist: {
    get title() {
      return t.onboarding.reminders.dentist[0];
    },
    time: '09:00',
    recurrence: { freq: 'monthly', interval: 6, byMonthDay: 1 },
    start: (today) => nextDayOfMonth(today, 1),
  },
  smoke: {
    get title() {
      return t.onboarding.reminders.smoke[0];
    },
    time: '10:00',
    recurrence: yearly(1),
    start: (today) => nextDayOfMonth(today, 1, 1),
  },
};

const eventData = (title: string, startDate: string, time: string, recurrence?: Recurrence) => ({
  title,
  kind: 'reminder',
  allDay: false,
  startDate,
  startTime: time,
  ...(recurrence ? { recurrence } : {}),
  notify: { minutesBefore: 0, enabled: true },
});

/** The start-data importers "templates" and "text" of the reminders tab. */
export function parseReminders(input: ImportInput, ctx: { today: string }): ImportParseResult {
  const candidates: ImportCandidate[] = [];
  if (input.kind === 'template') {
    for (const id of input.ids) {
      const tpl = TEMPLATES[id];
      if (!tpl) continue;
      const startDate = tpl.start(ctx.today);
      candidates.push({
        collection: 'event',
        data: eventData(tpl.title, startDate, tpl.time, tpl.recurrence),
        label: tpl.title,
        detail: `${describeRecurrence(tpl.recurrence)} · ab ${startDate}, ${tpl.time} Uhr`,
        dedupeKey: reminderKey(tpl.title),
      });
    }
  } else if (input.kind === 'text') {
    for (const title of parseLines(input.text, { max: 200 })) {
      candidates.push({
        collection: 'event',
        data: eventData(title, ctx.today, '09:00'),
        label: title,
        detail: `heute, 09:00 Uhr`,
        dedupeKey: reminderKey(title),
      });
    }
  }
  return { candidates, notes: [] };
}
