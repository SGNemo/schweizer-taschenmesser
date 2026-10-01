/** Google Calendar API v3 (read only): calendar list and incremental event sync. */
import { addDaysStr, pad2, toDateString } from '@/core/time/dates';
import type {
  CalendarCapability,
  CalendarSyncRequest,
  CalendarSyncResult,
  ConnectorContext,
  ExternalCalendar,
  ExternalEvent,
} from '@/core/connectors/types';
import { googleGet } from './http';

const API = 'https://www.googleapis.com/calendar/v3';
const NOTE_LIMIT = 2000;
const MAX_PAGES = 40;

interface ApiCalendar {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
}

interface ApiEvent {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

/** An RFC 3339 instant as the wall clock of this device. */
export function localParts(dateTime: string): { date: string; time: string } | undefined {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return undefined;
  return {
    date: toDateString(d),
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * Descriptions may contain HTML; keep readable text only. Parsed into an inert document (nothing
 * runs or loads) instead of stripping tags with regexes, which nested input like `<scr<b>ipt>` defeats.
 */
function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll('script, style, noscript, template, iframe, object')
    .forEach((e) => e.remove());
  doc.querySelectorAll('br').forEach((e) => e.replaceWith('\n'));
  doc.querySelectorAll('p, div, li').forEach((e) => e.append('\n'));
  return doc.body.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, NOTE_LIMIT);
}

/** Null when the event has no usable start (cancelled stubs, malformed items). */
export function toExternalEvent(e: ApiEvent): ExternalEvent | undefined {
  if (!e.id || !e.start) return undefined;
  const kind =
    e.eventType === 'birthday' ? 'birthday' : e.eventType === 'fromGmail' ? 'gmail' : 'event';
  const base = {
    extId: e.id,
    etag: e.etag,
    title: (e.summary ?? '').trim() || 'Ohne Titel',
    location: e.location?.trim() || undefined,
    note: e.description ? plainText(e.description) || undefined : undefined,
    url: e.htmlLink,
    kind,
  } as const;

  if (e.start.date) {
    // All-day: `end.date` is exclusive.
    const last = e.end?.date ? addDaysStr(e.end.date, -1) : e.start.date;
    return {
      ...base,
      allDay: true,
      startDate: e.start.date,
      endDate: last > e.start.date ? last : undefined,
    };
  }
  const start = e.start.dateTime ? localParts(e.start.dateTime) : undefined;
  if (!start) return undefined;
  const end = e.end?.dateTime ? localParts(e.end.dateTime) : undefined;
  return {
    ...base,
    allDay: false,
    startDate: start.date,
    startTime: start.time,
    endDate: end && end.date > start.date ? end.date : undefined,
    endTime: end?.time,
  };
}

export async function listGoogleCalendars(ctx: ConnectorContext): Promise<ExternalCalendar[]> {
  const out: ExternalCalendar[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { json } = await googleGet(ctx, `${API}/users/me/calendarList`, {
      minAccessRole: 'reader',
      maxResults: '250',
      pageToken,
    });
    const body = json as { items?: ApiCalendar[]; nextPageToken?: string };
    for (const c of body.items ?? [])
      out.push({
        id: c.id,
        name: (c.summaryOverride ?? c.summary ?? c.id).trim(),
        color:
          c.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(c.backgroundColor)
            ? c.backgroundColor
            : undefined,
        primary: c.primary === true,
      });
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function fetchEvents(
  ctx: ConnectorContext,
  req: CalendarSyncRequest,
  syncToken: string | undefined,
): Promise<CalendarSyncResult | 'gone'> {
  const events: ExternalEvent[] = [];
  const removedIds: string[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const url = `${API}/calendars/${encodeURIComponent(req.calendarId)}/events`;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { status, json } = await googleGet(
      ctx,
      url,
      {
        singleEvents: 'true',
        maxResults: '250',
        pageToken,
        // A sync token replaces the time window; deleted events then arrive as "cancelled".
        ...(syncToken
          ? { syncToken }
          : {
              timeMin: `${req.from}T00:00:00Z`,
              timeMax: `${req.to}T23:59:59Z`,
              showDeleted: 'false',
            }),
      },
      [410],
    );
    if (status === 410) return 'gone';
    const body = json as { items?: ApiEvent[]; nextPageToken?: string; nextSyncToken?: string };
    for (const item of body.items ?? []) {
      if (item.status === 'cancelled') {
        if (item.id) removedIds.push(item.id);
        continue;
      }
      const ev = toExternalEvent(item);
      if (ev) events.push(ev);
    }
    pageToken = body.nextPageToken;
    nextSyncToken = body.nextSyncToken ?? nextSyncToken;
    if (!pageToken) break;
  }
  return { events, removedIds, nextSyncToken, full: !syncToken };
}

export const googleCalendar: CalendarCapability = {
  listCalendars: listGoogleCalendars,
  async sync(ctx, req) {
    if (req.syncToken) {
      const incremental = await fetchEvents(ctx, req, req.syncToken);
      if (incremental !== 'gone') return incremental;
      // 410 GONE: the token expired; start over with a full window.
    }
    const full = await fetchEvents(ctx, req, undefined);
    if (full === 'gone') return { events: [], removedIds: [], full: true };
    return full;
  },
};
