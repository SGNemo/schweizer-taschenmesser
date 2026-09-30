import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { commitImport } from '@/core/importer/batches';
import type { ImportInput } from '@/core/importer/types';
import { buildPreview } from '@/core/importer/plan';
import { allManifests, getManifest } from '@/core/modules/registry';
import type * as FetchModule from '@/core/net/fetchPublic';
import { PublicFetchError } from '@/core/net/fetchPublic';
import { setNow } from '@/core/time/now';
import { pruneArticles, refreshAll, refreshFeed } from '../fetch';
import {
  ago,
  articleId,
  articlesToPrune,
  backoffMs,
  matchesQuery,
  parseWords,
  passesFilters,
} from '../logic';
import { articleRepo, feedRepo, feedStateRepo } from '../repo';
import { STARTER_FEEDS } from '../starter';

const fetchPublic = vi.hoisted(() => vi.fn());
vi.mock('@/core/net/fetchPublic', async (importOriginal) => ({
  ...(await importOriginal<typeof FetchModule>()),
  fetchPublic,
}));

const NOW = new Date(2026, 8, 29, 12, 0).getTime();
const HOUR = 3_600_000;

const rss = (
  items: { guid: string; title: string; teaser?: string; date?: string }[],
  title = 'Beispiel-Nachrichten',
) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>${items
    .map(
      (i) =>
        `<item><guid>${i.guid}</guid><title>${i.title}</title><link>https://news.example.test/${i.guid}</link><description>${i.teaser ?? ''}</description><pubDate>${i.date ?? 'Tue, 29 Sep 2026 08:00:00 GMT'}</pubDate></item>`,
    )
    .join('')}</channel></rss>`;

const respond = (body: string, headers: Record<string, string> = {}, status = 200) =>
  new Response(status === 304 ? null : body, { status, headers });

beforeEach(async () => {
  fetchPublic.mockReset();
  setNow(() => NOW);
  for (const t of [
    'news_feed',
    'news_article',
    'news_feedstate',
    'bookmarks_item',
    '_outbox',
    '_imports',
  ])
    await db.table(t).clear();
});
afterEach(() => setNow());

async function addFeed(url = 'https://news.example.test/feed.xml') {
  return feedRepo.create({ url, title: 'Beispiel', category: 'nachrichten', active: true });
}

describe('pure helpers', () => {
  it('parses word lists and applies keyword and mute filters', () => {
    expect(parseWords('Klima, Bahn ; Wahl\n')).toEqual(['klima', 'bahn', 'wahl']);
    const a = { title: 'Bahn streikt', teaser: 'Wegen der Wahl' };
    expect(passesFilters(a, [], [])).toBe(true);
    expect(passesFilters(a, ['klima'], [])).toBe(false);
    expect(passesFilters(a, ['klima', 'bahn'], [])).toBe(true);
    expect(passesFilters(a, [], ['wahl'])).toBe(false);
    expect(matchesQuery(a, 'bahn wahl')).toBe(true);
    expect(matchesQuery(a, 'bahn sport')).toBe(false);
  });

  it('prunes old unsaved articles and everything beyond the per-feed limit', () => {
    const day = 86_400_000;
    const mk = (id: string, ageDays: number, saved = false, feedId = 'f') => ({
      id,
      feedId,
      publishedAt: NOW - ageDays * day,
      saved,
    });
    expect(articlesToPrune([mk('new', 1), mk('old', 40), mk('oldSaved', 40, true)], NOW)).toEqual([
      'old',
    ]);
    const many = Array.from({ length: 505 }, (_, i) => mk(`a${i}`, 1 + i / 1000));
    const doomed = articlesToPrune(many, NOW);
    expect(doomed).toHaveLength(5);
    expect(doomed).toContain('a504'); // the oldest ones go
  });

  it('backs off exponentially up to six hours, and words times in German', () => {
    expect([1, 2, 3, 20].map(backoffMs)).toEqual([300_000, 600_000, 1_200_000, 6 * HOUR]);
    expect(ago(NOW - 30_000, NOW)).toBe('gerade eben');
    expect(ago(NOW - 5 * 60_000, NOW)).toBe('vor 5 Min.');
    expect(ago(NOW - 3 * HOUR, NOW)).toBe('vor 3 Std.');
    expect(ago(NOW - 30 * HOUR, NOW)).toBe('gestern');
    expect(ago(NOW - 72 * HOUR, NOW)).toBe('vor 3 Tagen');
  });

  it('derives stable article ids per feed and guid', () => {
    expect(articleId('f1', 'g')).toBe(articleId('f1', 'g'));
    expect(articleId('f1', 'g')).not.toBe(articleId('f1', 'h'));
    expect(articleId('f1', 'g')).not.toBe(articleId('f2', 'g'));
  });
});

describe('refreshFeed', () => {
  it('stores new articles, keeps read flags, and asks with validators next time', async () => {
    const feed = await addFeed();
    fetchPublic.mockResolvedValueOnce(
      respond(
        rss([
          { guid: 'a', title: 'Erster' },
          { guid: 'b', title: 'Zweiter' },
        ]),
        { etag: '"v1"' },
      ),
    );
    expect(await refreshFeed(feed)).toEqual({ status: 'updated', added: 2, changed: 0 });
    const [first] = (await articleRepo.active().toArray()).filter((a) => a.title === 'Erster');
    await articleRepo.update(first!.id, { read: true });

    // Second fetch: validators are sent; a changed title updates, the read flag survives.
    fetchPublic.mockResolvedValueOnce(
      respond(
        rss([
          { guid: 'a', title: 'Erster (aktualisiert)' },
          { guid: 'b', title: 'Zweiter' },
          { guid: 'c', title: 'Dritter' },
        ]),
        { etag: '"v2"' },
      ),
    );
    expect(await refreshFeed(feed)).toEqual({ status: 'updated', added: 1, changed: 1 });
    expect(fetchPublic.mock.calls[1]![1].headers['if-none-match']).toBe('"v1"');
    const all = await articleRepo.active().toArray();
    expect(all).toHaveLength(3);
    expect(all.find((a) => a.guid === 'a')).toMatchObject({
      title: 'Erster (aktualisiert)',
      read: true,
    });

    // 304 = nothing new.
    fetchPublic.mockResolvedValueOnce(respond('', { etag: '"v2"' }, 304));
    expect(await refreshFeed(feed)).toEqual({ status: 'unchanged' });
    expect(fetchPublic.mock.calls[2]![1].headers['if-none-match']).toBe('"v2"');
  });

  it('never queues articles for sync, and they are not part of sync or backup tables', async () => {
    const feed = await addFeed();
    fetchPublic.mockResolvedValueOnce(respond(rss([{ guid: 'a', title: 'Erster' }])));
    await refreshFeed(feed);
    const queued = (await db.table('_outbox').toArray()).map(
      (o: { collection: string }) => o.collection,
    );
    expect(queued).toEqual(['news_feed']); // the feed itself syncs, its articles and state do not
    const synced = syncedTableNames(allManifests);
    expect(synced).toContain('news_feed');
    expect(synced).not.toContain('news_article');
    expect(synced).not.toContain('news_feedstate');
  });

  it('records failures with backoff and reports the reason', async () => {
    const feed = await addFeed();
    fetchPublic.mockResolvedValueOnce(respond('<html>Fehler</html>', {}, 200));
    expect(await refreshFeed(feed)).toEqual({ status: 'failed', error: 'format' });
    fetchPublic.mockResolvedValueOnce(respond('', {}, 503));
    expect(await refreshFeed(feed)).toEqual({ status: 'failed', error: 'http' });
    fetchPublic.mockRejectedValueOnce(new PublicFetchError('no-proxy'));
    expect(await refreshFeed(feed)).toEqual({ status: 'failed', error: 'no-proxy' });
    fetchPublic.mockRejectedValueOnce(new TypeError('offline'));
    expect(await refreshFeed(feed)).toEqual({ status: 'failed', error: 'network' });
    const state = await feedStateRepo.get(feed.id);
    expect(state).toMatchObject({ failures: 4, lastError: 'network' });
    expect(state!.nextAt).toBe(NOW + 40 * 60_000); // 5 · 2³ minutes
  });
});

describe('refreshAll', () => {
  it('skips feeds in backoff and feeds that were loaded recently, unless forced', async () => {
    const a = await addFeed('https://a.example.test/f.xml');
    const b = await addFeed('https://b.example.test/f.xml');
    await feedRepo.create({
      url: 'https://off.example.test/f.xml',
      title: 'Aus',
      category: 'sonstiges',
      active: false,
    });
    fetchPublic.mockImplementation(async () => respond(rss([{ guid: 'x', title: 'T' }])));

    expect(await refreshAll({ maxAgeMs: HOUR })).toEqual({ added: 2, failed: 0, feeds: 2 });
    expect(fetchPublic).toHaveBeenCalledTimes(2); // inactive feed not fetched

    // Fresh → nothing due. Forced → both again.
    expect((await refreshAll({ maxAgeMs: HOUR })).feeds).toBe(0);
    expect((await refreshAll({ force: true })).feeds).toBe(2);

    // A failing feed backs off: a round right afterwards leaves it alone until nextAt has passed.
    fetchPublic.mockRejectedValue(new TypeError('x'));
    await refreshFeed(a);
    fetchPublic.mockImplementation(async () => respond(rss([{ guid: 'x', title: 'T' }])));
    fetchPublic.mockClear();
    expect((await refreshAll()).feeds).toBe(1); // only b
    expect(fetchPublic.mock.calls[0]![0]).toBe(b.url);
    setNow(() => NOW + 10 * 60_000); // past the 5 minute backoff
    expect((await refreshAll()).feeds).toBe(2);
  });

  it('prunes old articles after a round and keeps saved ones', async () => {
    const feed = await addFeed();
    const old = NOW - 40 * 86_400_000;
    await articleRepo.createMany([
      {
        id: 'o1',
        data: {
          feedId: feed.id,
          guid: 'o1',
          title: 'Alt',
          teaser: '',
          publishedAt: old,
          read: false,
          saved: false,
        },
      },
      {
        id: 'o2',
        data: {
          feedId: feed.id,
          guid: 'o2',
          title: 'Alt gemerkt',
          teaser: '',
          publishedAt: old,
          read: true,
          saved: true,
        },
      },
      {
        id: 'n1',
        data: {
          feedId: feed.id,
          guid: 'n1',
          title: 'Neu',
          teaser: '',
          publishedAt: NOW,
          read: false,
          saved: false,
        },
      },
    ]);
    expect(await pruneArticles()).toBe(1);
    expect((await articleRepo.active().toArray()).map((a) => a.id).sort()).toEqual(['n1', 'o2']);
    expect(await db.table('news_article').count()).toBe(2); // really deleted, no tombstones
  });
});

describe('start-data importer', () => {
  const manifest = getManifest('news')!;
  async function parse(id: string, input: ImportInput) {
    const runtime = (await manifest.contributions!.onboarding!.load!()).default;
    const parsed = await runtime.parse(id, input, {
      today: '2026-09-29',
      options: {},
      batchId: 'tb',
    });
    return { runtime, parsed, rows: await buildPreview(manifest, runtime, parsed.candidates) };
  }

  it('offers the starter pack by topic and imports only the ticked feeds', async () => {
    const { parsed, rows } = await parse('starter', {
      kind: 'template',
      ids: ['tagesschau', 'heise'],
    });
    expect(parsed.candidates.map((c) => c.label)).toEqual(['tagesschau', 'heise online']);
    expect(rows.every((r) => r.selected)).toBe(true);
    await commitImport(manifest, { batchId: 'tb', importerId: 'starter', source: 's', rows });
    expect((await feedRepo.active().toArray()).map((f) => f.title).sort()).toEqual([
      'heise online',
      'tagesschau',
    ]);
    const again = await parse('starter', { kind: 'template', ids: ['tagesschau'] });
    expect(again.rows[0]!.duplicate).toBe(true);
  });

  it('covers every topic in the starter pack', () => {
    expect(new Set(STARTER_FEEDS.map((f) => f.category))).toEqual(
      new Set(['nachrichten', 'technik', 'wissenschaft', 'natur']),
    );
    for (const f of STARTER_FEEDS) expect(f.url).toMatch(/^https:\/\//);
  });

  it('checks an address once and takes the feed title', async () => {
    fetchPublic.mockResolvedValueOnce(respond(rss([{ guid: 'a', title: 'A' }], 'Mein Feed')));
    const ok = await parse('url', {
      kind: 'form',
      values: { url: 'https://blog.example.test/feed', category: 'technik' },
    });
    expect(ok.rows[0]!.candidate).toMatchObject({
      label: 'Mein Feed',
      data: { url: 'https://blog.example.test/feed', category: 'technik' },
    });

    expect(
      (await parse('url', { kind: 'form', values: { url: 'javascript:alert(1)' } })).parsed
        .notes[0],
    ).toMatch(/keine gültige Adresse/);
    fetchPublic.mockResolvedValueOnce(respond('<html/>'));
    expect(
      (await parse('url', { kind: 'form', values: { url: 'https://x.example.test/' } })).parsed
        .notes[0],
    ).toMatch(/kein lesbarer Feed/);
  });
});
