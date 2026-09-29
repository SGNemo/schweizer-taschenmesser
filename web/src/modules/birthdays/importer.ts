import { parseDayMonth } from '@/core/io/dates';
import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { birthdayRepo } from './repo';

const keyOf = (name: string, month: number, day: number) =>
  `${name.trim().toLowerCase()}|${month}-${day}`;

/** "Anna Beispiel 15.03.1985", "15.03. Oma", "Max, 2.11." – the date is the token with dots. */
export function parseBirthdayLine(
  line: string,
): { name: string; day: number; month: number; year?: number } | undefined {
  const match = /(\d{1,2}\.\s?\d{1,2}\.?(?:\s?(?:\d{4}|\d{2}))?)/.exec(line);
  if (!match) return undefined;
  const date = parseDayMonth(match[1]!);
  const name = line
    .replace(match[1]!, ' ')
    .replace(/[,;:–-]+\s*$|^\s*[,;:–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return date && name ? { name, ...date } : undefined;
}

const runtime: ImporterRuntime = {
  parse(_id, input) {
    if (input.kind !== 'text') return { candidates: [], notes: [] };
    const candidates: ImportCandidate[] = [];
    let skipped = 0;
    for (const line of parseLines(input.text, { max: 500 })) {
      const b = parseBirthdayLine(line);
      if (!b) {
        skipped++;
        continue;
      }
      candidates.push({
        collection: 'birthday',
        data: { name: b.name, month: b.month, day: b.day, ...(b.year ? { year: b.year } : {}) },
        label: b.name,
        detail: `${String(b.day).padStart(2, '0')}.${String(b.month).padStart(2, '0')}.${b.year ?? ''}`,
        dedupeKey: keyOf(b.name, b.month, b.day),
      });
    }
    return { candidates, notes: skipped ? [t.onboarding.lines(skipped)] : [] };
  },
  async existingKeys() {
    const rows = await birthdayRepo.active().toArray();
    return new Set(rows.map((r) => keyOf(r.name, r.month, r.day)));
  },
};

export default runtime;
