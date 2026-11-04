import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { parseOpml } from '@/importers/opml/parse';
import { skipNotes } from '@/importers/report';
import { addSkip, type SkipCounts } from '@/importers/types';
import { feedKey, hostOf, normalizeFeedUrl } from './logic';
import { feedRepo } from './repo';

function candidate(
  title: string,
  url: string,
  category: string,
  siteUrl?: string,
): ImportCandidate {
  const name = title.trim() || hostOf(url);
  return {
    collection: 'feed',
    data: { title: name, url, category, ...(siteUrl ? { siteUrl } : {}) },
    label: name,
    detail: [hostOf(url), category].filter(Boolean).join(' · '),
    dedupeKey: feedKey(url),
  };
}

const runtime: ImporterRuntime = {
  parse(_id, input) {
    const skipped: SkipCounts = {};
    const candidates: ImportCandidate[] = [];
    if (input.kind === 'file') {
      for (const file of input.files ?? [{ name: input.fileName, text: input.text }]) {
        const r = parseOpml(file.text);
        if (r.invalid) addSkip(skipped, 'unreadable');
        for (const [reason, n] of Object.entries(r.skipped))
          addSkip(skipped, reason as keyof SkipCounts, n);
        for (const f of r.feeds) {
          const url = normalizeFeedUrl(f.url);
          if (url) candidates.push(candidate(f.title, url, f.category, f.siteUrl));
          else addSkip(skipped, 'unsupported');
        }
      }
    } else if (input.kind === 'text') {
      // One feed per line: an address, optionally with a name in front of it.
      for (const line of parseLines(input.text, { max: 500 })) {
        const word = line.split(/\s+/).find((w) => normalizeFeedUrl(w));
        const url = word && normalizeFeedUrl(word);
        if (!url) addSkip(skipped, 'unsupported');
        else candidates.push(candidate(line.replace(word, '').trim(), url, ''));
      }
    }
    return { candidates, notes: skipNotes(skipped), skipped };
  },
  async existingKeys() {
    const rows = await feedRepo.active().toArray();
    return new Set(rows.map((r) => feedKey(r.url)));
  },
};

export default runtime;
