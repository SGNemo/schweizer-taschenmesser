import { formatMoney } from '@/core/money';
import { formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import type { CaptureFields, CaptureNote, CaptureRecurrence, CaptureType } from '../parser';

export interface PreviewChip {
  id: string;
  label: string;
  /** Assumptions and doubtful values are highlighted so they never pass unseen. */
  warn?: boolean;
}

const NOTE_LABEL: Record<CaptureNote, string> = {
  get 'assumed-date'() {
    return t.quickCapture.chip.assumedDate;
  },
  get 'rolled-year'() {
    return t.quickCapture.chip.rolledYear;
  },
  get 'past-date'() {
    return t.quickCapture.chip.pastDate;
  },
  get 'approx-time'() {
    return t.quickCapture.chip.approxTime;
  },
  get 'ambiguous-time'() {
    return t.quickCapture.chip.ambiguousTime;
  },
};

/** "Montag–Freitag" for a run of three or more days in a row, else the names with commas. */
function weekdayNames(days: number[]): string {
  const names = t.quickCapture.recurrence.weekdays;
  const sorted = [...days].sort((x, y) => x - y);
  const run = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  return run
    ? `${names[sorted[0]! - 1]}–${names[sorted[sorted.length - 1]! - 1]}`
    : sorted.map((d) => names[d - 1]).join(', ');
}

export function describeRecurrence(r: CaptureRecurrence): string {
  const rc = t.quickCapture.recurrence;
  const unit = { daily: rc.days, weekly: rc.weeks, monthly: rc.months, yearly: rc.years }[r.freq];
  let base: string;
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const days = r.byWeekday;
    if (r.interval === 1) {
      base =
        days.length === 1
          ? rc.everyWeekday(rc.weekdays[days[0]! - 1] ?? '')
          : rc.onDays(weekdayNames(days));
    } else {
      base = `${rc.every(r.interval, unit)}, ${rc.onDays(weekdayNames(days))}`;
    }
  } else if (r.freq === 'monthly' && r.byMonthDay !== undefined && r.interval === 1) {
    base = rc.monthDay(r.byMonthDay);
  } else if (r.interval > 1) {
    base = rc.every(r.interval, unit);
  } else {
    base = rc[r.freq];
  }
  return r.until ? `${base}, ${rc.until(formatDay(r.until, 'd. MMM yyyy'))}` : base;
}

/** "Heute", "Morgen" or a short date, with the calendar date appended for the two relative words. */
export function describeDate(date: string, today: string): string {
  const label = relativeDayLabel(date, today);
  return label === 'Heute' || label === 'Morgen' ? `${label}, ${formatDay(date, 'd. MMM')}` : label;
}

const usesDate = (type: CaptureType) =>
  type === 'todo' ||
  type === 'event' ||
  type === 'reminder' ||
  type === 'finance' ||
  type === 'invoice' ||
  type === 'subscription' ||
  type === 'birthday';
const usesTime = (type: CaptureType) => type === 'todo' || type === 'event' || type === 'reminder';

/** The live preview: what will be saved where, derived from the parse result and the chosen type. */
export function previewChips(
  fields: CaptureFields,
  type: CaptureType | undefined,
  notes: readonly CaptureNote[],
  today: string,
): PreviewChip[] {
  if (!type) return [];
  const chips: PreviewChip[] = [
    { id: 'target', label: t.quickCapture.chip.to(t.quickCapture.target[type]) },
  ];
  if (fields.date && usesDate(type))
    chips.push({ id: 'date', label: describeDate(fields.date, today) });
  if (fields.time && usesTime(type)) {
    const range = fields.endTime ? `${fields.time}–${fields.endTime}` : fields.time;
    chips.push({ id: 'time', label: `${range} Uhr` });
  }
  if (type === 'todo' && fields.priority) {
    const c = t.quickCapture.chip;
    chips.push({
      id: 'priority',
      label: [c.priorityLow, c.priorityMid, c.priorityHigh][fields.priority - 1]!,
    });
  }
  if (type === 'todo' && fields.estimateMin)
    chips.push({ id: 'estimate', label: t.todos.estimateAbout(fields.estimateMin) });
  if (type === 'event' && fields.date && !fields.time)
    chips.push({ id: 'allDay', label: t.quickCapture.chip.allDay });
  if (fields.recurrence && (type === 'event' || type === 'reminder' || type === 'subscription')) {
    chips.push({ id: 'recurrence', label: describeRecurrence(fields.recurrence) });
  }
  if (type === 'finance' && fields.amountMinor) {
    const kind =
      fields.kind === 'income' ? t.quickCapture.chip.income : t.quickCapture.chip.expense;
    chips.push({ id: 'amount', label: `${kind} ${formatMoney(fields.amountMinor)}` });
  }
  if ((type === 'invoice' || type === 'subscription') && fields.amountMinor)
    chips.push({ id: 'amount', label: formatMoney(fields.amountMinor) });
  if (fields.url && type !== 'note') {
    try {
      chips.push({ id: 'url', label: new URL(fields.url).hostname });
    } catch {
      // A malformed link simply gets no chip; the adapter drops it on save.
    }
  }
  for (const n of notes) {
    const relevant = n.includes('time') ? usesTime(type) : usesDate(type);
    if (relevant) chips.push({ id: `note-${n}`, label: NOTE_LABEL[n], warn: true });
  }
  return chips;
}
