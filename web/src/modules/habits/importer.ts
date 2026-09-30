import { parseLines } from '@/core/io/textLines';
import type { ImporterRuntime } from '@/core/importer/types';
import { habitRepo } from './repo';
import { ALL_DAYS } from './schema';

const nameKey = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'text') return { candidates: [], notes: [] };
    return {
      candidates: parseLines(input.text, { max: 100 }).map((name) => ({
        collection: 'habit',
        data: { name, weekdays: ALL_DAYS, archived: false },
        label: name,
        detail: 'jeden Tag',
        dedupeKey: nameKey(name),
      })),
      notes: [],
    };
  },
  async existingKeys() {
    const rows = await habitRepo.active().toArray();
    return new Set(rows.filter((r) => !r.archived).map((r) => nameKey(r.name)));
  },
};

export default runtime;
