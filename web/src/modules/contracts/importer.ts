import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { contractRepo } from './repo';

const keyOf = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'connector') return { candidates: [], notes: [] };
    const m = t.onboarding.mail;
    const candidates: ImportCandidate[] = [];
    for (const f of input.findings) {
      if (f.kind !== 'contract') continue;
      const parts = [
        f.date ? `Ende ${formatDay(f.date, 'd. MMM yyyy')}` : m.noEnd,
        f.noticeDays !== undefined ? m.notice(f.noticeDays) : undefined,
      ].filter(Boolean);
      candidates.push({
        collection: 'contract',
        data: {
          name: f.title,
          kind: 'contract',
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
    return new Set((await contractRepo.active().toArray()).map((c) => keyOf(c.name)));
  },
};

export default runtime;
