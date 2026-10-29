import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { PAPER_TEMPLATES, type PaperTemplate } from './logic';
import { documentRepo } from './repo';

const keyOf = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind === 'template') {
      const p = t.onboarding.papers;
      const candidates = input.ids
        .filter((id): id is PaperTemplate => (PAPER_TEMPLATES as readonly string[]).includes(id))
        .map((id): ImportCandidate => {
          const { name, category } = p.items[id];
          return {
            collection: 'document',
            data: { title: name, category, note: p.templatesHint },
            label: name,
            detail: p.kind,
            dedupeKey: keyOf(name),
          };
        });
      return { candidates, notes: [] };
    }
    if (input.kind !== 'connector') return { candidates: [], notes: [] };
    const m = t.onboarding.mail;
    const candidates: ImportCandidate[] = [];
    for (const f of input.findings) {
      if (f.kind !== 'contract') continue;
      const parts = [
        f.date ? m.endsOn(formatDay(f.date, 'd. MMM yyyy')) : m.noEnd,
        f.noticeDays !== undefined ? m.notice(f.noticeDays) : undefined,
      ].filter(Boolean);
      candidates.push({
        collection: 'document',
        data: {
          title: f.title,
          category: 'contract',
          endDate: f.date,
          noticeDays: f.noticeDays,
          note: f.url ? m.source(f.url) : undefined,
        },
        label: f.title,
        detail: parts.join(' · '),
        dedupeKey: keyOf(f.title),
        ref: f.ref,
        ...(f.date ? {} : { warning: m.noEnd }),
      });
    }
    return { candidates, notes: [] };
  },
  async existingKeys() {
    return new Set((await documentRepo.active().toArray()).map((d) => keyOf(d.title)));
  },
};

export default runtime;
