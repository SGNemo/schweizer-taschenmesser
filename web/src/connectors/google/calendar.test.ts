// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import type { ConnectorContext, ConnectorError } from '@/core/connectors/types';
import { googleCalendar, listGoogleCalendars, toExternalEvent } from './calendar';

beforeAll(() => {
  process.env.TZ = 'Europe/Berlin'; // wall-clock conversion below is asserted in this zone
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

interface Call {
  url: URL;
  auth: string | null;
}

function ctxWith(handler: (call: Call) => Response): { ctx: ConnectorContext; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const call = { url: new URL(input), auth: new Headers(init?.headers).get('authorization') };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return {
    calls,
    ctx: {
      fetch: fetchFn,
      accessToken: async () => 'AT-123',
      fetchPublic: fetchFn,
      secrets: {
        get: async () => undefined,
        set: async () => undefined,
        delete: async () => undefined,
      },
      redact: (s) => s,
    },
  };
}

describe('toExternalEvent', () => {
  it('converts timed events to the wall clock of this device', () => {
    const e = toExternalEvent({
      id: 'e1',
      etag: '"1"',
      summary: 'Zahnarzt',
      location: 'Praxis Muster',
      htmlLink: 'https://calendar.example.test/e1',
      start: { dateTime: '2026-10-05T14:30:00+02:00' },
      end: { dateTime: '2026-10-05T15:15:00+02:00' },
    })!;
    expect(e).toMatchObject({
      extId: 'e1',
      etag: '"1"',
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '14:30',
      endTime: '15:15',
      location: 'Praxis Muster',
      kind: 'event',
    });
    expect(e.endDate).toBeUndefined();
  });

  it('treats the exclusive end of an all-day event as inclusive', () => {
    const e = toExternalEvent({
      id: 'e2',
      summary: 'Urlaub',
      start: { date: '2026-08-03' },
      end: { date: '2026-08-10' },
    })!;
    expect(e).toMatchObject({ allDay: true, startDate: '2026-08-03', endDate: '2026-08-09' });
    const single = toExternalEvent({
      id: 'e3',
      summary: 'Feiertag',
      start: { date: '2026-10-03' },
      end: { date: '2026-10-04' },
    })!;
    expect(single.endDate).toBeUndefined();
  });

  it('marks birthdays and mail-derived events, strips HTML notes, names untitled events', () => {
    expect(
      toExternalEvent({
        id: 'b',
        summary: 'Anna',
        eventType: 'birthday',
        start: { date: '2026-05-05' },
      })!.kind,
    ).toBe('birthday');
    expect(
      toExternalEvent({
        id: 'g',
        summary: 'Flug',
        eventType: 'fromGmail',
        start: { date: '2026-05-05' },
      })!.kind,
    ).toBe('gmail');
    const e = toExternalEvent({
      id: 'n',
      description: 'Zeile 1<br>Zeile&nbsp;2 <b>fett</b>',
      start: { date: '2026-05-05' },
    })!;
    expect(e.note).toBe('Zeile 1\nZeile 2 fett');
    expect(e.title).toBe('Ohne Titel');
  });

  it('turns descriptions into inert plain text', () => {
    const note = (description: string) =>
      toExternalEvent({ id: 'n', description, start: { date: '2026-05-05' } })!.note;
    // Nested/broken tags must not leave a working tag behind.
    expect(note('a <scr<b>ipt>x</scr</b>ipt> b')).not.toMatch(/<\/?script/i);
    expect(note('<script>alert(1)</script>Hallo<style>p{}</style>')).toBe('Hallo');
    // Entities are decoded once: an escaped tag stays text, `&amp;lt;` is not decoded twice.
    expect(note('1 &lt; 2 &amp; 3')).toBe('1 < 2 & 3');
    expect(note('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    expect(note('<p>Eins</p><p>Zwei</p><ul><li>a</li><li>b</li></ul>')).toBe('Eins\nZwei\na\nb');
    expect(note('x'.repeat(5000))).toHaveLength(2000);
    expect(note('<b></b>')).toBeUndefined();
  });

  it('drops events without a usable start', () => {
    expect(toExternalEvent({ id: 'x' })).toBeUndefined();
    expect(toExternalEvent({ id: 'x', start: { dateTime: 'kaputt' } })).toBeUndefined();
  });
});

describe('listGoogleCalendars', () => {
  it('follows pages and keeps name, colour and primary flag', async () => {
    const { ctx, calls } = ctxWith(({ url }) =>
      url.searchParams.get('pageToken')
        ? json(200, { items: [{ id: 'team', summary: 'Team', backgroundColor: '#123456' }] })
        : json(200, {
            items: [
              {
                id: 'me@example.test',
                summary: 'me@example.test',
                summaryOverride: 'Privat',
                primary: true,
                backgroundColor: '#ff0000',
              },
            ],
            nextPageToken: 'p2',
          }),
    );
    expect(await listGoogleCalendars(ctx)).toEqual([
      { id: 'me@example.test', name: 'Privat', color: '#ff0000', primary: true },
      { id: 'team', name: 'Team', color: '#123456', primary: false },
    ]);
    expect(calls[0]!.auth).toBe('Bearer AT-123');
  });
});

describe('googleCalendar.sync', () => {
  const req = { calendarId: 'me@example.test', from: '2026-08-01', to: '2027-10-01' };

  it('does a windowed full sync and returns the sync token', async () => {
    const { ctx, calls } = ctxWith(() =>
      json(200, {
        items: [{ id: 'e1', summary: 'A', start: { date: '2026-09-30' } }],
        nextSyncToken: 'ST1',
      }),
    );
    const r = await googleCalendar.sync(ctx, req);
    expect(r).toMatchObject({ full: true, nextSyncToken: 'ST1', removedIds: [] });
    expect(r.events).toHaveLength(1);
    const q = calls[0]!.url.searchParams;
    expect(q.get('singleEvents')).toBe('true');
    expect(q.get('timeMin')).toBe('2026-08-01T00:00:00Z');
    expect(q.get('syncToken')).toBeNull();
    expect(calls[0]!.url.pathname).toBe('/calendar/v3/calendars/me%40example.test/events');
  });

  it('syncs incrementally with the token and reports cancelled events as removed', async () => {
    const { ctx, calls } = ctxWith(() =>
      json(200, {
        items: [
          { id: 'e1', status: 'cancelled' },
          { id: 'e2', summary: 'Neu', start: { date: '2026-10-01' } },
        ],
        nextSyncToken: 'ST2',
      }),
    );
    const r = await googleCalendar.sync(ctx, { ...req, syncToken: 'ST1' });
    expect(r).toMatchObject({ full: false, removedIds: ['e1'], nextSyncToken: 'ST2' });
    expect(r.events.map((e) => e.extId)).toEqual(['e2']);
    const q = calls[0]!.url.searchParams;
    expect(q.get('syncToken')).toBe('ST1');
    expect(q.get('timeMin')).toBeNull(); // a token replaces the window
  });

  it('starts over with a full window when the token is gone (410)', async () => {
    const { ctx, calls } = ctxWith(({ url }) =>
      url.searchParams.get('syncToken')
        ? json(410, { error: { errors: [{ reason: 'fullSyncRequired' }] } })
        : json(200, { items: [], nextSyncToken: 'ST9' }),
    );
    const r = await googleCalendar.sync(ctx, { ...req, syncToken: 'OLD' });
    expect(r).toMatchObject({ full: true, nextSyncToken: 'ST9' });
    expect(calls).toHaveLength(2);
  });

  it('maps errors: 401 expired, quota rate-limited, other 403 denied, 5xx network', async () => {
    const fail = async (status: number, reason: string, headers: Record<string, string> = {}) => {
      const { ctx } = ctxWith(() => json(status, { error: { errors: [{ reason }] } }, headers));
      return googleCalendar.sync(ctx, req).catch((e: unknown) => e as ConnectorError);
    };
    expect(await fail(401, 'authError')).toMatchObject({ code: 'expired' });
    expect(await fail(403, 'rateLimitExceeded')).toMatchObject({ code: 'rate-limited' });
    expect(await fail(429, 'x', { 'retry-after': '30' })).toMatchObject({
      code: 'rate-limited',
      retryAfter: 30,
    });
    expect(await fail(403, 'accessNotConfigured')).toMatchObject({ code: 'denied' });
    expect(await fail(503, 'backendError')).toMatchObject({ code: 'network' });
  });
});
