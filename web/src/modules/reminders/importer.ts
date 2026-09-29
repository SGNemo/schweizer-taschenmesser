import { addDaysStr, isoWeekday } from '@/core/time/dates';
import { describeRecurrence } from '@/core/recurrence/describe';
import type { Recurrence } from '@/core/recurrence/types';
import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { reminderRepo } from './repo';

const pad = (n: number) => String(n).padStart(2, '0');
const titleKey = (title: string) => title.trim().toLowerCase();

/** The next date on or after `today` that is day `day` of `month` (any month when omitted). */
export function nextDayOfMonth(today: string, day: number, month?: number): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  for (let offset = 0; offset < 36; offset++) {
    const total = y * 12 + (m - 1) + offset;
    const year = Math.floor(total / 12);
    const mon = (total % 12) + 1;
    if (month !== undefined && mon !== month) continue;
    const candidate = `${year}-${pad(mon)}-${pad(day)}`;
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
    title: t.onboarding.reminders.rent[0],
    time: '08:00',
    recurrence: monthly(),
    start: (today) => nextDayOfMonth(today, 1),
  },
  statements: {
    title: t.onboarding.reminders.statements[0],
    time: '09:00',
    recurrence: monthly(),
    start: (today) => nextDayOfMonth(today, 1),
  },
  trash: {
    title: t.onboarding.reminders.trash[0],
    time: '19:00',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [7] },
    start: (today) => nextWeekday(today, 7),
  },
  insurance: {
    title: t.onboarding.reminders.insurance[0],
    time: '09:00',
    recurrence: yearly(11),
    start: (today) => nextDayOfMonth(today, 1, 11),
  },
  energy: {
    title: t.onboarding.reminders.energy[0],
    time: '09:00',
    recurrence: yearly(9),
    start: (today) => nextDayOfMonth(today, 1, 9),
  },
  tax: {
    title: t.onboarding.reminders.tax[0],
    time: '09:00',
    recurrence: yearly(6),
    start: (today) => nextDayOfMonth(today, 1, 6),
  },
  dentist: {
    title: t.onboarding.reminders.dentist[0],
    time: '09:00',
    recurrence: { freq: 'monthly', interval: 6, byMonthDay: 1 },
    start: (today) => nextDayOfMonth(today, 1),
  },
  smoke: {
    title: t.onboarding.reminders.smoke[0],
    time: '10:00',
    recurrence: yearly(1),
    start: (today) => nextDayOfMonth(today, 1, 1),
  },
};

const runtime: ImporterRuntime = {
  parse(_id, input, ctx) {
    const candidates: ImportCandidate[] = [];
    if (input.kind === 'template') {
      for (const id of input.ids) {
        const tpl = TEMPLATES[id];
        if (!tpl) continue;
        const startDate = tpl.start(ctx.today);
        candidates.push({
          collection: 'reminder',
          data: { title: tpl.title, startDate, time: tpl.time, recurrence: tpl.recurrence },
          label: tpl.title,
          detail: `${describeRecurrence(tpl.recurrence)} · ab ${startDate}, ${tpl.time} Uhr`,
          dedupeKey: titleKey(tpl.title),
        });
      }
    } else if (input.kind === 'text') {
      for (const title of parseLines(input.text, { max: 200 })) {
        candidates.push({
          collection: 'reminder',
          data: { title, startDate: ctx.today, time: '09:00' },
          label: title,
          detail: `heute, 09:00 Uhr`,
          dedupeKey: titleKey(title),
        });
      }
    }
    return { candidates, notes: [] };
  },
  async existingKeys() {
    return new Set((await reminderRepo.active().toArray()).map((r) => titleKey(r.title)));
  },
};

export default runtime;
