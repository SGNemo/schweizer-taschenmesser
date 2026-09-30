import { describe, expect, it } from 'vitest';
import type { ConnectorContext } from '@/core/connectors/types';
import { buildQuery, googleMail } from './mail';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const message = (
  id: string,
  subject: string,
  snippet: string,
  extra: { name: string; value: string }[] = [],
) => ({
  id,
  snippet,
  internalDate: String(Date.UTC(2026, 8, 20)),
  payload: {
    headers: [
      { name: 'From', value: 'Stadtwerke Muster <rechnung@example.test>' },
      { name: 'Subject', value: subject },
      ...extra,
    ],
  },
});

function ctxWith(handler: (url: URL) => Response) {
  const urls: URL[] = [];
  const fetchFn = (async (input: string) => {
    const url = new URL(input);
    urls.push(url);
    return handler(url);
  }) as unknown as typeof fetch;
  const ctx: ConnectorContext = {
    fetch: fetchFn,
    accessToken: async () => 'AT',
    fetchPublic: fetchFn,
    secrets: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
    },
    redact: (s) => s,
  };
  return { ctx, urls };
}

describe('buildQuery', () => {
  it('limits the period and excludes spam and trash', () => {
    const q = buildQuery('2026-09-29', 3);
    expect(q).toContain('after:2026/06/30');
    expect(q).toContain('rechnung OR invoice');
    expect(q).toContain('-in:spam');
  });
});

describe('googleMail.scan', () => {
  it('reads headers and snippets only, never the body, and returns local findings', async () => {
    const { ctx, urls } = ctxWith((url) => {
      if (url.pathname.endsWith('/messages'))
        return json({ messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
      const id = url.pathname.split('/').pop()!;
      if (id === 'a')
        return json(message('a', 'Ihre Rechnung', 'Betrag 87,40 €, fällig am 15.10.2026'));
      if (id === 'b')
        return json(
          message('b', 'Sonderangebot', 'Rechnung sparen! 5,00 € Rabatt', [
            { name: 'List-Unsubscribe', value: '<mailto:x@example.test>' },
          ]),
        );
      return json(message('c', 'Wochenende', 'Wie geht es dir?'));
    });
    const progress: [number, number][] = [];
    const { findings, read } = await googleMail.scan(ctx, {
      months: 3,
      today: '2026-09-29',
      onProgress: (d, t) => progress.push([d, t]),
    });
    expect(read).toBe(3);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: 'invoice',
      ref: 'gmail:a',
      amountMinor: 8740,
      date: '2026-10-15',
    });
    expect(progress.at(-1)).toEqual([3, 3]);

    // Every message call asks for metadata only.
    const gets = urls.filter((u) => !u.pathname.endsWith('/messages'));
    expect(gets).toHaveLength(3);
    for (const u of gets) {
      expect(u.searchParams.get('format')).toBe('metadata');
      expect(u.searchParams.getAll('metadataHeaders')).toEqual([
        'From',
        'Subject',
        'Date',
        'List-Unsubscribe',
      ]);
    }
    expect(
      urls.some(
        (u) => u.searchParams.get('format') === 'full' || u.searchParams.get('format') === 'raw',
      ),
    ).toBe(false);
  });

  it('caps the number of messages and follows list pages', async () => {
    const { ctx, urls } = ctxWith((url) => {
      if (url.pathname.endsWith('/messages')) {
        const page = url.searchParams.get('pageToken') ? 2 : 1;
        const size = Number(url.searchParams.get('maxResults'));
        return json({
          messages: Array.from({ length: size }, (_, i) => ({ id: `m${page}-${i}` })),
          nextPageToken: 'more',
        });
      }
      return json(message('x', 'Hallo', 'nichts'));
    });
    await googleMail.scan(ctx, { months: 1, today: '2026-09-29' });
    const gets = urls.filter((u) => !u.pathname.endsWith('/messages')).length;
    expect(gets).toBe(300);
  });
});
