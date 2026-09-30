import { describe, expect, it } from 'vitest';
import type { ConnectorContext, ConnectorError } from '@/core/connectors/types';
import { normalizeIcsUrl, saveSubscriptions } from './subscriptions';
import { contentTag, syncIcs } from './sync';
import connector from './index';

// Invented calendar feed.
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:a1@example.test',
  'SUMMARY:Vereinssitzung',
  'DTSTART:20260930T180000',
  'DTEND:20260930T200000',
  'LOCATION:Vereinsheim',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a2@example.test',
  'SUMMARY:Sommerfest',
  'DTSTART;VALUE=DATE:20250601',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a3@example.test',
  'SUMMARY:Stammtisch',
  'DTSTART:20250105T190000',
  'RRULE:FREQ=MONTHLY;BYMONTHDAY=5',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function ctxWith(fetchPublic: ConnectorContext['fetchPublic']): ConnectorContext {
  const store = new Map<string, string>();
  return {
    fetch,
    accessToken: async () => {
      throw new Error('no token');
    },
    fetchPublic,
    secrets: {
      get: async (k) => store.get(k),
      set: async (k, v) => void store.set(k, v),
      delete: async (k) => void store.delete(k),
    },
    redact: (s) => s,
  };
}

const okFeed = async () => new Response(FEED, { status: 200 });
const window = { calendarId: 'c1', from: '2026-08-01', to: '2027-10-01' };

describe('normalizeIcsUrl', () => {
  it('turns webcal into https and refuses other schemes', () => {
    expect(normalizeIcsUrl(' webcal://cal.example.test/x.ics ')).toBe(
      'https://cal.example.test/x.ics',
    );
    expect(normalizeIcsUrl('file:///etc/passwd')).toBeUndefined();
    expect(normalizeIcsUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeIcsUrl('kein url')).toBeUndefined();
  });
});

describe('syncIcs', () => {
  it('returns events inside the window plus recurring ones, as a full sync', async () => {
    const ctx = ctxWith(okFeed);
    await saveSubscriptions(ctx, [
      { id: 'c1', name: 'Verein', url: 'https://cal.example.test/x.ics' },
    ]);
    const r = await syncIcs(ctx, window);
    expect(r.full).toBe(true);
    expect(r.removedIds).toEqual([]);
    expect(r.events.map((e) => e.title).sort()).toEqual(['Stammtisch', 'Vereinssitzung']); // Sommerfest 2025 is outside
    const meeting = r.events.find((e) => e.title === 'Vereinssitzung')!;
    expect(meeting).toMatchObject({
      extId: 'a1@example.test',
      startDate: '2026-09-30',
      startTime: '18:00',
      endTime: '20:00',
      location: 'Vereinsheim',
      kind: 'event',
    });
    expect(r.events.find((e) => e.title === 'Stammtisch')!.recurrence).toMatchObject({
      freq: 'monthly',
    });
  });

  it('gives the same tag to unchanged events and another one when something changed', async () => {
    const base = { title: 'A', allDay: false, startDate: '2026-09-30', startTime: '18:00' };
    expect(contentTag(base)).toBe(contentTag({ ...base }));
    expect(contentTag(base)).not.toBe(contentTag({ ...base, startTime: '19:00' }));
  });

  it('reports the failure kinds distinctly', async () => {
    const make = async (fetchPublic: ConnectorContext['fetchPublic']) => {
      const ctx = ctxWith(fetchPublic);
      await saveSubscriptions(ctx, [
        { id: 'c1', name: 'V', url: 'https://cal.example.test/x.ics' },
      ]);
      return syncIcs(ctx, window).catch((e: unknown) => e as ConnectorError);
    };
    expect(await make(async () => new Response('x', { status: 404 }))).toMatchObject({
      code: 'bad-response',
    });
    expect(await make(async () => new Response('x', { status: 503 }))).toMatchObject({
      code: 'network',
    });
    expect(
      await make(async () => new Response('x', { status: 429, headers: { 'retry-after': '90' } })),
    ).toMatchObject({
      code: 'rate-limited',
      retryAfter: 90,
    });
    expect(await make(async () => new Response('<html>hi</html>', { status: 200 }))).toMatchObject({
      code: 'bad-response',
    });
    expect(
      await make(async () => {
        throw new TypeError('offline');
      }),
    ).toMatchObject({ code: 'network' });
    expect(await syncIcs(ctxWith(okFeed), window).catch((e: unknown) => e)).toMatchObject({
      code: 'not-configured',
    });
  });
});

describe('connector definition', () => {
  it('lists the configured subscriptions as calendars and is configured only with one', async () => {
    const ctx = ctxWith(okFeed);
    expect(await connector.isConfigured!(ctx)).toBe(false);
    await saveSubscriptions(ctx, [
      { id: 'c1', name: 'Verein', url: 'https://cal.example.test/x.ics' },
    ]);
    expect(await connector.isConfigured!(ctx)).toBe(true);
    expect(await connector.calendar!.listCalendars(ctx)).toEqual([
      { id: 'c1', name: 'Verein', primary: true },
    ]);
  });
});
