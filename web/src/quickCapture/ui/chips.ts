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
  'assumed-date': t.quickCapture.chip.assumedDate,
  'rolled-year': t.quickCapture.chip.rolledYear,
  'past-date': t.quickCapture.chip.pastDate,
  'approx-time': t.quickCapture.chip.approxTime,
  'ambiguous-time': t.quickCapture.chip.ambiguousTime,
};

export function describeRecurrence(r: CaptureRecurrence): string {
  const rc = t.quickCapture.recurrence;
  if (r.freq === 'weekly' && r.byWeekday?.length === 1 && r.interval === 1) {
    return rc.everyWeekday(rc.weekdays[r.byWeekday[0]! - 1] ?? '');
  }
  if (r.freq === 'monthly' && r.byMonthDay !== undefined && r.interval === 1) {
    return rc.monthDay(r.byMonthDay);
  }
  if (r.interval > 1) {
    const unit = { daily: rc.days, weekly: rc.weeks, monthly: rc.months, yearly: rc.years }[r.freq];
    return rc.every(r.interval, unit);
  }
  return rc[r.freq];
}

/** "Heute", "Morgen" or a short date, with the calendar date appended for the two relative words. */
export function describeDate(date: string, today: string): string {
  const label = relativeDayLabel(date, today);
  return label === 'Heute' || label === 'Morgen' ? `${label}, ${formatDay(date, 'd. MMM')}` : label;
}

const usesDate = (type: CaptureType) =>
  type === 'todo' || type === 'event' || type === 'reminder' || type === 'finance';
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
  if (fields.time && usesTime(type)) chips.push({ id: 'time', label: `${fields.time} Uhr` });
  if (type === 'event' && fields.date && !fields.time)
    chips.push({ id: 'allDay', label: t.quickCapture.chip.allDay });
  if (fields.recurrence && (type === 'event' || type === 'reminder')) {
    chips.push({ id: 'recurrence', label: describeRecurrence(fields.recurrence) });
  }
  if (type === 'finance' && fields.amountMinor) {
    const kind =
      fields.kind === 'income' ? t.quickCapture.chip.income : t.quickCapture.chip.expense;
    chips.push({ id: 'amount', label: `${kind} ${formatMoney(fields.amountMinor)}` });
  }
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
