import { safeHttpUrl } from '@/core/io/feed';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { loadFeed } from './fetch';
import { feedRepo } from './repo';
import { CATEGORIES, type Category } from './schema';
import { STARTER_FEEDS } from './starter';

/** Same address (ignoring scheme case, `www.` and a trailing slash) = same feed. */
export const urlKey = (url: string): string =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');

const asCategory = (value: string | undefined): Category =>
  (CATEGORIES as readonly string[]).includes(value ?? '') ? (value as Category) : 'sonstiges';

const runtime: ImporterRuntime = {
  async parse(id, input) {
    if (id === 'starter' && input.kind === 'template') {
      const wanted = new Set(input.ids);
      const candidates: ImportCandidate[] = STARTER_FEEDS.filter((f) => wanted.has(f.id)).map(
        (f) => ({
          collection: 'feed',
          data: { url: f.url, title: f.title, category: f.category, active: true },
          label: f.title,
          detail: `${t.news.categories[f.category]} · ${f.url}`,
          dedupeKey: urlKey(f.url),
        }),
      );
      return { candidates, notes: [] };
    }
    if (id === 'url' && input.kind === 'form') {
      const url = safeHttpUrl(input.values.url);
      if (!url) return { candidates: [], notes: [t.news.feeds.badUrl] };
      try {
        const loaded = await loadFeed(url);
        if (loaded.status !== 'ok') return { candidates: [], notes: [t.news.feeds.errors.format!] };
        const title = loaded.feed.title || new URL(url).hostname;
        const category = asCategory(input.values.category);
        return {
          candidates: [
            {
              collection: 'feed',
              data: { url, title, category, active: true },
              label: title,
              detail: `${t.news.categories[category]} · ${loaded.feed.items.length} Artikel`,
              dedupeKey: urlKey(url),
            },
          ],
          notes: [],
        };
      } catch (e) {
        const code = e instanceof Error ? e.message : 'network';
        return {
          candidates: [],
          notes: [
            t.onboarding.news.unreachable(
              t.news.feeds.errors[code] ?? t.news.feeds.errors.network!,
            ),
          ],
        };
      }
    }
    return { candidates: [], notes: [] };
  },
  async existingKeys() {
    return new Set((await feedRepo.active().toArray()).map((f) => urlKey(f.url)));
  },
};

export default runtime;
