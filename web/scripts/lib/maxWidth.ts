/**
 * Counts the `max-width` declarations of a module stylesheet (UI audit 2026-11, package 0a-1b). The page
 * width belongs to `manifest.layout` / `PageContainer` (docs/RULES.md), so every `max-width` in
 * `src/modules/**\/*.module.css` is on a baseline that only shrinks (`scripts/baselines/max-width.json`).
 *
 * A hit is a declaration whose property is exactly `max-width`, outside every `@media` and `@container`
 * block. Not a hit: the query itself (`@media (max-width: 40rem)`), a custom property (`--x-max-width`),
 * `max-inline-size`, and a declaration inside one of the two at-rules.
 */
export interface MaxWidthHit {
  /** 1-based line of the declaration. */
  line: number;
  selector: string;
  value: string;
}

const CONDITIONAL = /^@(?:media|container)\b/i;

/** Comments and strings become blanks of the same length, so offsets and line numbers stay true. */
function blank(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m.replace(/[^\n]/g, ' '));
}

export function findMaxWidth(source: string): MaxWidthHit[] {
  const css = blank(source);
  const hits: MaxWidthHit[] = [];
  /** Preludes of the open blocks, outermost first. */
  const open: string[] = [];
  let start = 0;
  const declaration = (end: number) => {
    const m = /^(\s*)max-width\s*:\s*([\s\S]*)$/i.exec(css.slice(start, end));
    if (!m || open.length === 0 || open.some((p) => CONDITIONAL.test(p))) return;
    hits.push({
      line: css.slice(0, start + m[1]!.length).split('\n').length,
      selector: open.at(-1)!,
      value: m[2]!.trim().replace(/\s+/g, ' '),
    });
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
