import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { normalizeLaunchUrl, PRESETS, urlKey } from './logic';
import { linkRepo } from './repo';

const runtime: ImporterRuntime = {
  parse(id, input) {
    if (id === 'presets' && input.kind === 'template') {
      const wanted = new Set(input.ids);
      const candidates: ImportCandidate[] = PRESETS.filter((p) => wanted.has(p.id)).map((p) => ({
        collection: 'link',
        data: { title: p.title, url: p.url, group: p.group },
        label: p.title,
        detail: p.url,
        dedupeKey: urlKey(p.url),
      }));
      return { candidates, notes: [] };
    }
    if (id === 'link' && input.kind === 'form') {
      const url = normalizeLaunchUrl(input.values.url ?? '');
      const title = (input.values.title ?? '').trim();
      if (!url || !title) return { candidates: [], notes: [t.onboarding.launcher.invalid] };
      const group = (input.values.group ?? '').trim();
      return {
        candidates: [
          {
            collection: 'link',
            data: { title, url, ...(group ? { group } : {}) },
            label: title,
            detail: url,
            dedupeKey: urlKey(url),
          },
        ],
        notes: [],
      };
    }
    return { candidates: [], notes: [] };
  },
  async existingKeys() {
    return new Set((await linkRepo.active().toArray()).map((l) => urlKey(l.url)));
  },
};

export default runtime;
