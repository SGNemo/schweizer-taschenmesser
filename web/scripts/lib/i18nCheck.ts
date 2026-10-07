/**
 * Catalog checks for `npm run check:i18n` (pure; the catalogs are passed in):
 *  - same keys as the German source (nothing missing, nothing extra), same kinds of values;
 *  - no empty texts; fixed-length lists (weekdays, months) keep their length;
 *  - functions run with sample arguments, return a non-empty string and keep every placeholder
 *    the German text shows (a translated sentence must still name the count, the name, …);
 *  - sentences identical to German are reported as untranslated (single words such as "Status"
 *    or brand names may legitimately stay; a list of accepted sentences can be passed).
 */

export interface CatalogIssue {
  path: string;
  problem: string;
}

const FIXED_LENGTH: Record<string, number> = {
  'recurrence.weekdaysShort': 7,
  'recurrence.months': 12,
};

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Sample arguments: numbers 0, 1, 2, 5, 21 (plural edges) and distinct marker strings. */
function sampleCalls(arity: number): unknown[][] {
  const calls: unknown[][] = [];
  for (const n of [0, 1, 2, 5, 21]) {
    calls.push(Array.from({ length: arity }, (_, i) => (i === 0 ? n : `‹${i}›`)));
    calls.push(Array.from({ length: arity }, (_, i) => `‹${i}›`));
    calls.push(Array.from({ length: arity }, () => n));
  }
  return calls;
}

function call(fn: unknown, args: unknown[]): string | Error {
  try {
    const r = (fn as (...a: unknown[]) => unknown)(...args);
    return typeof r === 'string' ? r : new Error(`returns ${typeof r}`);
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

/** Markers (`‹0›`, numbers) the German result contains must also appear in the translation. */
function missingMarkers(de: string, tr: string, args: unknown[]): string[] {
  return args
    .filter((a) => typeof a === 'string')
    .map(String)
    .filter((m) => de.includes(m) && !tr.includes(m));
}

const isSentence = (s: string) => /\p{L}{2,}.*\s+.*\p{L}{2,}/u.test(s.trim());

export function checkCatalog(
  source: unknown,
  catalog: unknown,
  opts: { sameAllowed?: ReadonlySet<string> } = {},
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const walk = (src: unknown, tr: unknown, path: string) => {
    if (isPlain(src)) {
      if (!isPlain(tr)) return void issues.push({ path, problem: 'object expected' });
      for (const k of Object.keys(src)) {
        const p = path ? `${path}.${k}` : k;
        if (!(k in tr)) issues.push({ path: p, problem: 'missing' });
        else walk(src[k], tr[k], p);
      }
      for (const k of Object.keys(tr))
        if (!(k in src)) issues.push({ path: path ? `${path}.${k}` : k, problem: 'extra key' });
      return;
    }
    if (typeof src === 'string') {
      if (typeof tr !== 'string') return void issues.push({ path, problem: 'string expected' });
      if (!tr.trim() && src.trim()) issues.push({ path, problem: 'empty' });
      else if (tr === src && isSentence(src) && !opts.sameAllowed?.has(path))
        issues.push({ path, problem: `untranslated: ${src.slice(0, 60)}` });
      return;
    }
    if (Array.isArray(src)) {
      if (!Array.isArray(tr)) return void issues.push({ path, problem: 'list expected' });
      const fixed = FIXED_LENGTH[path];
      if (fixed !== undefined && tr.length !== fixed)
        issues.push({ path, problem: `needs ${fixed} entries, has ${tr.length}` });
      if (src.length && !tr.length) issues.push({ path, problem: 'empty list' });
      tr.forEach((x, i) => {
        if (typeof src[0] === 'string' && (typeof x !== 'string' || !x.trim()))
          issues.push({ path: `${path}.${i}`, problem: 'empty' });
        if (isPlain(src[i])) walk(src[i], x, `${path}.${i}`);
      });
      return;
    }
    if (typeof src === 'function') {
      if (typeof tr !== 'function') return void issues.push({ path, problem: 'function expected' });
      for (const args of sampleCalls(src.length)) {
        const de = call(src, args);
        if (de instanceof Error) continue; // the German source does not take these arguments
        const out = call(tr, args);
        if (out instanceof Error) {
          issues.push({ path, problem: `throws for (${args.join(', ')}): ${out.message}` });
          break;
        }
        if (!out.trim() && de.trim()) {
          issues.push({ path, problem: `empty result for (${args.join(', ')})` });
          break;
        }
        const lost = missingMarkers(de, out, args);
        if (lost.length) {
          issues.push({ path, problem: `drops ${lost.join(', ')} for (${args.join(', ')})` });
          break;
        }
      }
    }
  };
  walk(source, catalog, '');
  return issues;
}
