/**
 * „heute nur A, B und C“ in the planner's field (use case „Tag kippt“, P4): the names of what stays. Pure. It only opens
 * „Nur das hier …“ with those things ticked – the rest moves only after he picks where (`keepOnly`).
 */
import { sameTitle } from './pastePlan';

const SENTENCE = /^(heute\s+)?nur\s+(?:noch\s+)?(.+?)(\s+heute)?[.!]?$/i;
/** What the field's own rules read („nur Donnerstag frei“, „heute nur 2 Stunden“): never taken over here. */
const OTHER =
  /^(?:\d|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so|morgen|übermorgen)\b/i;

export interface KeepSentence {
  /** One unit per named thing (a thing in parts is named once). */
  unitIds: string[];
  /** The sentence said „heute“: it belongs to today only. */
  today: boolean;
}

/**
 * The rows the sentence names: the whole rest as one title first, else each name of the list – a name matches the row
 * of equal title, else the one title that has a word starting with it. `undefined` when it is no such sentence, a name
 * is unclear or the rest is what the field reads itself (a day, an amount) – then the field reads it as before.
 */
export function readKeepSentence(
  text: string,
  rows: readonly { unitId: string; itemKey: string; title: string }[],
): KeepSentence | undefined {
  const m = SENTENCE.exec(text.trim());
  if (!m || OTHER.test(m[2]!.trim())) return undefined;
  const today = !!(m[1] || m[3]);
  const find = (name: string) => {
    const exact = rows.filter((r) => sameTitle(r.title) === name);
    const hits = exact.length
      ? exact
      : rows.filter((r) =>
          sameTitle(r.title)
            .split(/[\s,/-]+/)
            .some((_, i, words) => words.slice(i).join(' ').startsWith(name)),
        );
    // One unit per thing: its first part on the day.
    const things = hits.filter((r, i) => hits.findIndex((x) => x.itemKey === r.itemKey) === i);
    return things.length === 1 ? things[0]! : undefined;
  };
  const whole = find(sameTitle(m[2]!));
  if (whole && rows.some((r) => sameTitle(r.title) === sameTitle(m[2]!)))
    return { unitIds: [whole.unitId], today };
  const names = m[2]!
    .split(/\s*,\s*|\s+und\s+|\s*&\s*/i)
    .map((n) => sameTitle(n))
    .filter(Boolean);
  const picked: { unitId: string; itemKey: string }[] = [];
  for (const name of names) {
    const hit = find(name);
    if (!hit || picked.some((p) => p.itemKey === hit.itemKey)) return undefined;
    picked.push(hit);
  }
  return picked.length ? { unitIds: picked.map((p) => p.unitId), today } : undefined;
}
