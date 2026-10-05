/**
 * Reading aid ("Bionic" style): splits a text into runs and marks the start of every word as strong.
 * Pure and memoised; the visible text is never changed (joining the runs gives the input back).
 * Rules: words shorter than `minLen` graphemes stay plain, numbers, amounts, dates, times, codes,
 * URLs, e-mails and ALL-CAPS abbreviations are skipped, compounds split at hyphens are handled word by word.
 */
export interface ReadSegment {
  text: string;
  strong: boolean;
  /** The remainder of an emphasised word (after its strong start): the part that is dimmed in primary-ink text. */
  rest?: boolean;
}

export interface ReadableOptions {
  /** Share of each word that is emphasised, 0 < share ≤ 1 (settings: 0.3 / 0.4 / 0.5). */
  share: number;
  /** Words with fewer graphemes stay plain. */
  minLen?: number;
}

/** Longest emphasised start, so very long compounds do not turn bold for half their length. */
const MAX_STRONG = 6;
const DEFAULT_MIN_LEN = 4;
const CACHE_LIMIT = 500;
const CACHE_TEXT_LIMIT = 1200;

const graphemeSeg =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('de', { granularity: 'grapheme' })
    : null;

/** Grapheme clusters of `s` (an umlaut written as a + combining mark stays one unit). */
export function graphemes(s: string): string[] {
  if (graphemeSeg) return Array.from(graphemeSeg.segment(s), (x) => x.segment);
  // Fallback: attach combining marks to their base character.
  const out: string[] = [];
  for (const ch of s) {
    if (out.length > 0 && /^\p{M}$/u.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** A whitespace-delimited chunk that is data rather than prose. */
function isProtectedChunk(chunk: string): boolean {
  return (
    /\d/.test(chunk) || // numbers, amounts, dates, times, invoice and ticket codes
    /[@/\\_#]|:\/\//.test(chunk) || // e-mails, URLs, paths, identifiers, hashtags
    /^www\./i.test(chunk)
  );
}

const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

function emphasizeChunk(chunk: string, share: number, minLen: number, out: ReadSegment[]): void {
  if (isProtectedChunk(chunk)) {
    out.push({ text: chunk, strong: false });
    return;
  }
  let last = 0;
  for (const m of chunk.matchAll(WORD)) {
    const word = m[0];
    const at = m.index ?? 0;
    const g = graphemes(word);
    const abbreviation = g.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
    if (g.length < minLen || abbreviation) continue;
    const n = Math.min(MAX_STRONG, Math.max(1, Math.round(g.length * share)), g.length - 1);
    const head = g.slice(0, n).join('');
    if (at > last) out.push({ text: chunk.slice(last, at), strong: false });
    out.push({ text: head, strong: true });
    out.push({ text: word.slice(head.length), strong: false, rest: true });
    last = at + word.length;
  }
  if (last < chunk.length) out.push({ text: chunk.slice(last), strong: false });
}

function compute(text: string, share: number, minLen: number): ReadSegment[] {
  const raw: ReadSegment[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (part === '') continue;
    if (/^\s+$/.test(part)) raw.push({ text: part, strong: false });
    else emphasizeChunk(part, share, minLen, raw);
  }
  // Merge neighbours of the same kind so the DOM stays small.
  const merged: ReadSegment[] = [];
  for (const seg of raw) {
    if (seg.text === '') continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.strong === seg.strong && !prev.rest && !seg.rest) prev.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}

const cache = new Map<string, readonly ReadSegment[]>();

/** Memoised (small LRU): the same teaser is processed once, however often a list re-renders. */
export function emphasize(text: string, opts: ReadableOptions): readonly ReadSegment[] {
  const share = Math.min(1, Math.max(0.05, opts.share));
  const minLen = opts.minLen ?? DEFAULT_MIN_LEN;
  if (text.length > CACHE_TEXT_LIMIT) return compute(text, share, minLen);
  const key = `${share}|${minLen}|${text}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = compute(text, share, minLen);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return value;
}
