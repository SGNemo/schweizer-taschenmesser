import { ICS_NOTE_LIMIT, parseIcs, type IcsEvent } from '@/core/io/ics';
import {
  ConnectorError,
  type CalendarSyncRequest,
  type CalendarSyncResult,
  type ConnectorContext,
  type ExternalEvent,
} from '@/core/connectors/types';
import { loadSubscriptions } from './subscriptions';

/** Tiny stable hash (djb2) of the fields that matter; equal hash = unchanged event. */
export function contentTag(e: Omit<ExternalEvent, 'etag' | 'extId' | 'kind'>): string {
  const text = JSON.stringify([
    e.title,
    e.allDay,
    e.startDate,
    e.startTime,
    e.endDate,
    e.endTime,
    e.location,
    e.note,
    e.recurrence,
  ]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function toExternal(e: IcsEvent, index: number): ExternalEvent {
  const base = {
    title: e.title,
    allDay: e.allDay,
    startDate: e.startDate,
    startTime: e.startTime,
    endDate: e.endDate && e.endDate !== e.startDate ? e.endDate : undefined,
    endTime: e.endTime,
    location: e.location,
    note: e.note ? e.note.slice(0, ICS_NOTE_LIMIT) : undefined,
    recurrence: e.recurrence,
  };
  return {
    ...base,
    // Feeds without UIDs are rare; fall back to a key from the content and the position.
    extId: e.uid ?? `${e.startDate}|${e.startTime ?? ''}|${e.title}|${index}`,
    etag: contentTag(base),
    kind: 'event',
  };
}

/** Fetches one subscription and returns its events within the window (recurring ones always). */
export async function syncIcs(
  ctx: ConnectorContext,
  req: CalendarSyncRequest,
): Promise<CalendarSyncResult> {
  const subscription = (await loadSubscriptions(ctx)).find((s) => s.id === req.calendarId);
  if (!subscription) throw new ConnectorError('not-configured');
  let res: Response;
  try {
    res = await ctx.fetchPublic(subscription.url, { headers: { accept: 'text/calendar, */*' } });
  } catch (e) {
    if (e instanceof ConnectorError) throw e;
    throw new ConnectorError('network', ctx.redact(String(e)));
  }
  if (res.status === 429)
    throw new ConnectorError(
      'rate-limited',
      'rate-limited',
      Number(res.headers.get('retry-after')) || undefined,
    );
  if (!res.ok)
    throw new ConnectorError(res.status >= 500 ? 'network' : 'bad-response', `http ${res.status}`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new ConnectorError('bad-response', 'not a calendar');

  const events = parseIcs(text)
    .events.filter(
      (e) => e.recurrence || ((e.endDate ?? e.startDate) >= req.from && e.startDate <= req.to),
    )
    .map(toExternal);
  return { events, removedIds: [], full: true };
}
