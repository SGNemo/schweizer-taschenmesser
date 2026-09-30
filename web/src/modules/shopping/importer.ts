import { parseLines } from '@/core/io/textLines';
import type { ImporterRuntime } from '@/core/importer/types';
import { parseEntry } from './logic';
import { itemRepo } from './repo';

const nameKey = (name: string) => name.trim().toLowerCase();

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'text') return { candidates: [], notes: [] };
    return {
      candidates: parseLines(input.text, { max: 500 }).map((line) => {
        const { name, quantity } = parseEntry(line);
        return {
          collection: 'item',
          data: { name, done: false, ...(quantity ? { quantity } : {}) },
          label: name,
          ...(quantity ? { detail: quantity } : {}),
          dedupeKey: nameKey(name),
        };
      }),
      notes: [],
    };
  },
  async existingKeys() {
    const rows = await itemRepo.active().toArray();
    return new Set(rows.filter((r) => !r.done).map((r) => nameKey(r.name)));
  },
};

export default runtime;
