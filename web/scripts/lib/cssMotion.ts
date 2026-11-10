/**
 * Counts CSS motion of a module stylesheet that moves something else than `transform` / `opacity` (UI audit
 * 2026-11, follow-up to package 0a; CLAUDE.md, UI rules: "motion transform/opacity only"). Every such
 * declaration in `src/modules/**\/*.module.css` is on a baseline that only shrinks
 * (`scripts/baselines/css-motion.json`).
 *
 * A hit is
 * - an entry of a `transition` or `transition-property` declaration that names another property, `all`, or
 *   no property at all (`transition: 150ms` means `all`; so does a value that is only `var(…)`), and
 * - a declaration inside `@keyframes` of another property (an easing per keyframe is no motion of its own).
 *
 * Allowed: `transform`, `opacity` and the single transform properties `translate`, `scale`, `rotate`;
 * `none` is no motion. `@media` (also the reduced-motion one) is read like every other block. Not read: the
 * `animation` declaration itself (its `@keyframes` are), custom properties as declarations (`--x: …`
 * outside `@keyframes`), comments and strings.
 */
export interface CssMotionHit {
  /** 1-based line of the declaration. */
  line: number;
  /** Selector of the rule, or the `@keyframes` prelude. */
  selector: string;
  /** The animated property (`all` when none is named). */
  property: string;
  via: 'transition' | 'keyframes';
}

const ALLOWED = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate']);
const KEYFRAMES = /^@(?:-webkit-)?keyframes\b/i;
const TIME = /^[+-]?(?:\d+\.?\d*|\.\d+)m?s$/i;
/** What stands in a transition entry next to the property: easing keywords and the behaviour keywords. */
const NOT_A_PROPERTY = new Set([
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end',
  'normal',
  'allow-discrete',
]);

/** Comments and strings become blanks of the same length, so offsets and line numbers stay true. */
function blank(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Splits at `separator` outside parentheses. */
function split(value: string, separator: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of value) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0 && separator.test(c)) {
      out.push(current);
      current = '';
    } else current += c;
  }
  out.push(current);
  return out.map((p) => p.trim()).filter(Boolean);
}

/** The properties a `transition` / `transition-property` value animates (`all` for an entry without one). */
export function transitionProperties(value: string, shorthand: boolean): string[] {
  const entries = split(value.replace(/!important\s*$/i, ''), /,/);
  return entries.map((entry) => {
    const words = split(entry, /\s/).map((w) => w.toLowerCase());
    if (!shorthand) return words[0] ?? 'all';
    // Durations, easings and functions (`cubic-bezier()`, `steps()`, `var()`) are not the property.
    const named = words.filter((w) => !TIME.test(w) && !NOT_A_PROPERTY.has(w) && !w.includes('('));
    return named[0] ?? 'all';
  });
}

export function findCssMotion(source: string): CssMotionHit[] {
  const css = blank(source);
  const hits: CssMotionHit[] = [];
  /** Preludes of the open blocks, outermost first. */
  const open: string[] = [];
  let start = 0;
  const declaration = (end: number) => {
    const m = /^(\s*)([-\w]+)\s*:\s*([\s\S]*)$/.exec(css.slice(start, end));
    if (!m || open.length === 0) return;
    const property = m[2]!.toLowerCase();
    const at = { line: css.slice(0, start + m[1]!.length).split('\n').length };
    const keyframes = open.find((p) => KEYFRAMES.test(p));
    if (keyframes) {
      if (!ALLOWED.has(property) && property !== 'animation-timing-function')
        hits.push({ ...at, selector: keyframes, property, via: 'keyframes' });
      return;
    }
    if (property !== 'transition' && property !== 'transition-property') return;
    for (const p of transitionProperties(m[3]!, property === 'transition'))
      if (p !== 'none' && !ALLOWED.has(p))
        hits.push({ ...at, selector: open.at(-1)!, property: p, via: 'transition' });
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      open.push(css.slice(start, i).trim().replace(/\s+/g, ' '));
      start = i + 1;
    } else if (c === ';') {
      declaration(i);
      start = i + 1;
    } else if (c === '}') {
      declaration(i);
      open.pop();
      start = i + 1;
    }
  }
  return hits;
}
