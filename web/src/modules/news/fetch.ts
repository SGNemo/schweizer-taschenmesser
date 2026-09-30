/**
 * Fetching feeds: conditional requests, parsing, upserting articles (read/saved flags survive),
 * per-feed backoff and retention. Everything device-local except the feed list itself.
 */
import { FeedFormatError, parseFeed, type ParsedFeed } from '@/core/io/feed';
import { fetchPublic, PublicFetchError } from '@/core/net/fetchPublic';
import { now } from '@/core/time/now';
import { articleId, articlesToPrune, backoffMs } from './logic';
import { articleRepo, feedRepo, feedStateRepo } from './repo';
import type { Feed, FeedState } from './schema';

export type FetchFailure = 'no-proxy' | 'network' | 'http' | 'format';

export type RefreshResult =
  | { status: 'updated'; added: number; changed: number }
  | { status: 'unchanged' }
  | { status: 'failed'; error: FetchFailure };

/** Feeds larger than this are refused before parsing (the proxy caps at 2 MB as well). */
const MAX_TEXT = 3 * 1024 * 1024;

/** One request; throws `FetchFailure` codes as `Error.message`. */
export async function loadFeed(
  url: string,
  validators: { etag?: string; lastModified?: string } = {},
): Promise<
  | { status: 'not-modified'; etag?: string; lastModified?: string }
  | { status: 'ok'; feed: ParsedFeed; etag?: string; lastModified?: string }
> {
  let res: Response;
  try {
    const headers: Record<string, string> = {
      accept:
        'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
    };
    if (validators.etag) headers['if-none-match'] = validators.etag;
    if (validators.lastModified) headers['if-modified-since'] = validators.lastModified;
    res = await fetchPublic(url, { headers });
  } catch (e) {
    throw new Error(e instanceof PublicFetchError ? e.code : 'network', { cause: e });
  }
  const etag = res.headers.get('etag') ?? undefined;
  const lastModified = res.headers.get('last-modified') ?? undefined;
  if (res.status === 304) return { status: 'not-modified', etag, lastModified };
  if (!res.ok) throw new Error('http');
  const text = await res.text();
  if (text.length > MAX_TEXT) throw new Error('format');
  try {
    return { status: 'ok', feed: parseFeed(text, now(), url), etag, lastModified };
  } catch (e) {
    throw new Error(e instanceof FeedFormatError ? 'format' : 'network', { cause: e });
  }
}

async function saveState(feedId: string, patch: Partial<FeedState>): Promise<void> {
  const current = await feedStateRepo.get(feedId);
  const next = { failures: 0, nextAt: 0, ...current, ...patch };
  if (current) await feedStateRepo.update(feedId, next);
  else await feedStateRepo.create(next, { id: feedId });
}

/** Upserts the articles of a fetched feed; returns how many are new / changed. */
export async function storeArticles(
  feedId: string,
  parsed: ParsedFeed,
): Promise<{ added: number; changed: number }> {
  const existing = new Map(
    (await articleRepo.table.where('feedId').equals(feedId).toArray())
      .filter((a) => a.deletedAt === null)
      .map((a) => [a.id, a]),
  );
  const fresh: { id: string; data: (typeof parsed.items)[number] & { feedId: string } }[] = [];
  let changed = 0;
  for (const item of parsed.items) {
    const id = articleId(feedId, item.guid);
    const current = existing.get(id);
    if (!current) {
      fresh.push({ id, data: { ...item, feedId } });
    } else if (
      current.title !== item.title ||
      current.teaser !== item.teaser ||
      current.url !== item.url
    ) {
      await articleRepo.update(id, { title: item.title, teaser: item.teaser, url: item.url });
      changed += 1;
    }
  }
  if (fresh.length > 0)
    await articleRepo.createMany(
      fresh.map(({ id, data }) => ({
        id,
        data: {
          feedId,
          guid: data.guid,
          title: data.title,
          teaser: data.teaser,
          url: data.url,
          publishedAt: data.publishedAt,
          read: false,
          saved: false,
        },
      })),
    );
  return { added: fresh.length, changed };
}

export async function pruneArticles(): Promise<number> {
  const all = await articleRepo.active().toArray();
  const doomed = articlesToPrune(all, now());
  if (doomed.length > 0) await articleRepo.purge(doomed);
  return doomed.length;
}

export async function refreshFeed(feed: { id: string; url: string }): Promise<RefreshResult> {
  const state = await feedStateRepo.get(feed.id);
  try {
    const r = await loadFeed(feed.url, { etag: state?.etag, lastModified: state?.lastModified });
    const okState = {
      etag: r.etag,
      lastModified: r.lastModified,
      failures: 0,
      nextAt: 0,
      lastOkAt: now(),
      lastError: undefined,
    };
    if (r.status === 'not-modified') {
      await saveState(feed.id, okState);
      return { status: 'unchanged' };
    }
    const result = await storeArticles(feed.id, r.feed);
    await saveState(feed.id, okState);
    return { status: 'updated', ...result };
  } catch (e) {
    const code = (e instanceof Error ? e.message : 'network') as FetchFailure;
    const error: FetchFailure = ['no-proxy', 'network', 'http', 'format'].includes(code)
      ? code
      : 'network';
    const failures = (state?.failures ?? 0) + 1;
    await saveState(feed.id, { failures, nextAt: now() + backoffMs(failures), lastError: error });
    return { status: 'failed', error };
  }
}

export interface RefreshSummary {
  added: number;
  failed: number;
  feeds: number;
}

/**
 * Refreshes active feeds. Without `force` only those whose backoff has passed and whose last
 * success is older than `maxAgeMs`.
 */
export async function refreshAll(
  opts: { force?: boolean; maxAgeMs?: number } = {},
): Promise<RefreshSummary> {
  const feeds = (await feedRepo.active().toArray()).filter((f: Feed & { id: string }) => f.active);
  const states = new Map((await feedStateRepo.active().toArray()).map((s) => [s.id, s]));
  const t = now();
  const due = feeds.filter((f) => {
    if (opts.force) return true;
    const s = states.get(f.id);
    if (s && s.nextAt > t) return false;
    return !s?.lastOkAt || t - s.lastOkAt >= (opts.maxAgeMs ?? 0);
  });
  const summary: RefreshSummary = { added: 0, failed: 0, feeds: due.length };
  // Three at a time: polite to the hosts, quick enough for a dozen feeds.
  for (let i = 0; i < due.length; i += 3) {
    const results = await Promise.all(due.slice(i, i + 3).map((f) => refreshFeed(f)));
    for (const r of results) {
      if (r.status === 'updated') summary.added += r.added;
      if (r.status === 'failed') summary.failed += 1;
    }
  }
  await pruneArticles();
  return summary;
}
