/**
 * „heute nur A, B und C“ in the planner's field (use case „Tag kippt“, P4): the names of what stays today. Pure. It only
 * opens „Nur das hier …“ with those things ticked – the rest moves only after he picks where (`keepOnly`).
 */
import { sameTitle } from './pastePlan';

const SENTENCE = /^(?:heute\s+)?nur\s+(?:noch\s+)?(.+?)(?:\s+heute)?[.!]?$/i;

/**
 * The rows the sentence names, each name matching exactly one row (equal title, else the one title that contains it),
 * no row twice. `undefined` when it is no such sentence or a name is unclear – then the field reads it as before.
 */
export function readKeepSentence(
  text: string,
  rows: readonly { unitId: string; title: string }[],
): string[] | undefined {
  const m = SENTENCE.exec(text.trim());
  if (!m) return undefined;
  const names = m[1]!
    .split(/\s*,\s*|\s+und\s+|\s*&\s*/i)
    .map((n) => sameTitle(n))
    .filter(Boolean);
  if (!names.length) return undefined;
  const picked: string[] = [];
  for (const name of names) {
    const exact = rows.filter((r) => sameTitle(r.title) === name);
    const hits = exact.length ? exact : rows.filter((r) => sameTitle(r.title).includes(name));
    if (hits.length !== 1 || picked.includes(hits[0]!.unitId)) return undefined;
    picked.push(hits[0]!.unitId);
  }
  return picked;
}
