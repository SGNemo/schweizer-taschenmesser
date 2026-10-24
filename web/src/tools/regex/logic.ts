/**
 * Pure parts of the regex tester. `runRegex` is the only function that executes a user pattern; it is called
 * inside the web worker (`worker.ts`) so a runaway pattern can be stopped from outside (`run.ts`).
 * Never `eval` / `new Function`: the pattern only ever goes to the `RegExp` constructor.
 */

export const MAX_TEXT = 50_000;
export const MAX_MATCHES = 1_000;
export const TIMEOUT_MS = 1_000;
export const FLAGS = ['g', 'i', 'm', 's', 'u'] as const;
export type Flag = (typeof FLAGS)[number];

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  /** `undefined`: no replace preview. */
  replacement?: string;
}

export interface GroupHit {
  /** 1-based number of the capture group. */
  num: number;
  name?: string;
  /** `undefined`: the group did not take part in this match. */
  value?: string;
}

export interface Hit {
  index: number;
  end: number;
  text: string;
  groups: GroupHit[];
}

export type RegexOutcome =
  { ok: true; hits: Hit[]; capped: boolean; replaced?: string } | { ok: false; error: string };

/** Flags in the fixed order g i m s u, without duplicates or unknown letters. */
export function normalizeFlags(flags: Iterable<string>): string {
  const set = new Set(flags);
  return FLAGS.filter((f) => set.has(f)).join('');
}

/** Group names in order of appearance, by capture-group number (`undefined` for unnamed ones). */
export function groupNames(pattern: string): (string | undefined)[] {
  const names: (string | undefined)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '\\') {
      i++;
    } else if (inClass) {
      if (c === ']') inClass = false;
    } else if (c === '[') {
      inClass = true;
    } else if (c === '(') {
      if (pattern[i + 1] !== '?') names.push(undefined);
      else {
        // Named groups allow any identifier (`(?<ü>…)`, `(?<日付>…)`); `(?:`, `(?=`, `(?<=` and `(?<!`
        // capture nothing. A name that still fails to parse is pushed as unnamed so the numbering stays right.
        const m = /^\(\?<([\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*)>/u.exec(
          pattern.slice(i),
        );
        if (m) names.push(m[1]);
        else if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!')
          names.push(undefined);
      }
    }
  }
  return names;
}

export function runRegex(req: RegexRequest): RegexOutcome {
  const flags = normalizeFlags(req.flags);
  let re: RegExp;
  try {
    re = new RegExp(req.pattern, flags);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const parsed = groupNames(req.pattern);
  const toHit = (m: RegExpMatchArray | RegExpExecArray): Hit => {
    const index = m.index ?? 0;
    const groups: GroupHit[] = [];
    // The engine's count is the truth: when the scan disagrees, names could sit on the wrong group.
    const names = parsed.length === m.length - 1 ? parsed : [];
    for (let n = 1; n < m.length; n++) {
      const name = names[n - 1];
      groups.push({ num: n, ...(name ? { name } : {}), value: m[n] });
    }
    return { index, end: index + m[0].length, text: m[0], groups };
  };

  const hits: Hit[] = [];
  let capped = false;
  if (flags.includes('g')) {
    for (const m of req.text.matchAll(re)) {
      if (hits.length >= MAX_MATCHES) {
        capped = true;
        break;
      }
      hits.push(toHit(m));
    }
  } else {
    const m = re.exec(req.text);
    if (m) hits.push(toHit(m));
  }
  const out: RegexOutcome = { ok: true, hits, capped };
  if (req.replacement !== undefined) {
    // A fresh regex: the one above may carry lastIndex state.
    out.replaced = req.text.replace(new RegExp(req.pattern, flags), req.replacement);
  }
  return out;
}

export interface Segment {
  text: string;
  /** 1-based number of the hit this piece belongs to; `undefined` for text between hits. */
  hit?: number;
}

/** The text cut into plain and matched pieces. Empty matches have no width and get no piece. */
export function toSegments(text: string, hits: Hit[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  hits.forEach((h, i) => {
    if (h.end <= h.index || h.index < at) return;
    if (h.index > at) out.push({ text: text.slice(at, h.index) });
    out.push({ text: text.slice(h.index, h.end), hit: i + 1 });
    at = h.end;
  });
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
