import { describeRecurrence } from '@/core/recurrence/describe';
import { parseIcs, type IcsEvent, type IcsIssueCode } from '@/core/io/ics';
import type {
  ImportCandidate,
  ImportInput,
  ImporterRuntime,
  ImportParseResult,
} from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { eventKey } from './external';
import { eventRepo, externalRepo } from './repo';

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

function fromMail(input: ImportInput): ImportParseResult {
  if (input.kind !== 'connector') return { candidates: [], notes: [] };
  const candidates: ImportCandidate[] = [];
  for (const f of input.findings) {
    if (f.kind !== 'event' || !f.date) continue;
    candidates.push({
      collection: 'event',
      data: {
        title: f.title,
        allDay: !f.time,
        startDate: f.date,
        startTime: f.time,
        location: f.place,
        note: f.url ? t.onboarding.mail.source(f.url) : undefined,
      },
      label: f.title,
      detail: [formatDay(f.date, 'EEE, d. MMM yyyy'), f.time ?? 'ganztägig', f.place]
        .filter(Boolean)
        .join(' · '),
      dedupeKey: eventKey({ startDate: f.date, startTime: f.time, title: f.title }),
      ref: f.ref,
    });
  }
  return { candidates, notes: [] };
}

const runtime: ImporterRuntime = {
  parse(id, input) {
    if (id === 'mail') return fromMail(input);
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
    // Own events and events synced from other calendars (an appointment Google already knows about
    // must not be suggested again).
    const [own, external] = await Promise.all([
      eventRepo.active().toArray(),
      externalRepo.active().toArray(),
    ]);
    return new Set([...own.map(keyOf), ...own.map(eventKey), ...external.map(eventKey)]);
  },
};

export default runtime;
