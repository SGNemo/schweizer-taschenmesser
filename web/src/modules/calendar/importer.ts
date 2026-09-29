import { describeRecurrence } from '@/core/recurrence/describe';
import { parseIcs, type IcsEvent, type IcsIssueCode } from '@/core/io/ics';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { eventRepo } from './repo';

/** Same day, time and title (ignoring case) = same event. */
const keyOf = (e: { startDate: string; startTime?: string; title: string }) =>
  `${e.startDate}|${e.startTime ?? ''}|${e.title.trim().toLowerCase()}`;

function detail(e: IcsEvent): string {
  const day = formatDay(e.startDate, 'EEE, d. MMM yyyy');
  const time = e.allDay ? 'ganztägig' : `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}`;
  const parts = [day, time];
  if (e.endDate) parts[0] = `${day} – ${formatDay(e.endDate, 'EEE, d. MMM yyyy')}`;
  if (e.recurrence) parts.push(describeRecurrence(e.recurrence));
  if (e.location) parts.push(e.location);
  return parts.join(' · ');
}

const ISSUE_TEXT: Record<IcsIssueCode, (n: number) => string> = {
  exdate: t.onboarding.ics.exdate,
  'rrule-unsupported': t.onboarding.ics.rruleUnsupported,
  override: t.onboarding.ics.override,
  cancelled: t.onboarding.ics.cancelled,
  invalid: t.onboarding.ics.invalid,
};

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'file') return { candidates: [], notes: [] };
    const { events, issues } = parseIcs(input.text);
    const candidates: ImportCandidate[] = events.map((e) => {
      const { uid: _uid, ...data } = e;
      return {
        collection: 'event',
        data,
        label: e.title,
        detail: detail(e),
        dedupeKey: keyOf(e),
        ...(e.uid ? { ref: e.uid } : {}),
      };
    });
    const counts = new Map<IcsIssueCode, number>();
    for (const issue of issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    const notes = [...counts].map(([code, n]) => ISSUE_TEXT[code](n));
    return { candidates, notes };
  },
  async existingKeys() {
    return new Set((await eventRepo.active().toArray()).map(keyOf));
  },
};

export default runtime;
