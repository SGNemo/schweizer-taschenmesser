/**
 * Pseudo-localisation for testing (never offered to users): every text gets accented letters, is
 * about 40 % longer and is wrapped in ⟦ ⟧. Long languages (French, Portuguese) run about 30 % longer
 * than German, so a layout that survives this survives them; a German text that slips through
 * (hard-coded, or read once at import) is easy to spot because it has no brackets.
 */
const ACCENTS: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', A: 'Å', E: 'É', I: 'Î', O: 'Ø', U: 'Û', c: 'ç', n: 'ñ', s: 'š', y: 'ý',
};

/** Pseudo text for one string; placeholders like `{name}` and `#` stay untouched. */
export function pseudoText(s: string): string {
  if (!s.trim()) return s;
  let out = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    out += depth > 0 ? ch : (ACCENTS[ch] ?? ch);
  }
  const pad = '·'.repeat(Math.max(1, Math.round(s.length * 0.4)));
  return `⟦${out}${pad}⟧`;
}

/** Same shape as `source`, every string (also function results and arrays) pseudo-localised. */
export function pseudoCatalog<T>(source: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return pseudoText(v);
    if (typeof v === 'function')
      return (...args: unknown[]) => {
        const r = (v as (...a: unknown[]) => unknown)(...args);
        return typeof r === 'string' ? pseudoText(r) : r;
      };
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(source) as T;
}
