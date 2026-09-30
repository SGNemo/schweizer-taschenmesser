import { parseBookmarksHtml } from '@/core/io/bookmarksHtml';
import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { normalizeUrl } from './logic';
import { itemRepo } from './repo';

/** Scheme, host case and a trailing slash do not make a different bookmark. */
const urlKey = (url: string) => url.trim().toLowerCase().replace(/\/+$/, '');

function candidate(title: string, url: string, tags: string[] = []): ImportCandidate {
  return {
    collection: 'item',
    data: { title, url, kind: 'link', tags },
    label: title,
    detail: [url, ...(tags.length ? [tags.map((tag) => `#${tag}`).join(' ')] : [])].join(' · '),
    dedupeKey: urlKey(url),
  };
}

const URL_IN_LINE = /https?:\/\/\S+/i;

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind === 'file') {
      return {
        candidates: parseBookmarksHtml(input.text).map((b) => candidate(b.title, b.url, b.tags)),
        notes: [],
      };
    }
    if (input.kind !== 'text') return { candidates: [], notes: [] };
    const candidates: ImportCandidate[] = [];
    let skipped = 0;
    for (const line of parseLines(input.text, { max: 500 })) {
      const found = URL_IN_LINE.exec(line);
      const url = found && normalizeUrl(found[0]);
      if (!found || !url) {
        skipped++;
        continue;
      }
      const title = line.replace(found[0], '').trim() || url;
      candidates.push(candidate(title, url));
    }
    return { candidates, notes: skipped ? [t.onboarding.lines(skipped)] : [] };
  },
  async existingKeys() {
    const rows = await itemRepo.active().toArray();
    return new Set(rows.flatMap((r) => (r.url ? [urlKey(r.url)] : [])));
  },
};

export default runtime;
