/**
 * Which ink the text around a `ReadableText` has: `p` = the primary text colour, `m` = a muted token (`--text-muted`,
 * `--text-3`), `o` = anything else (coloured text, text on a filled button). The reading aid uses it to keep AA contrast
 * safe: the rest of a word is only dimmed in primary ink, and the start of a word is only brightened in muted ink.
 */
export type Ink = 'p' | 'm' | 'o';

interface Probes {
  key: string;
  primary: string;
  muted: string[];
}
let cached: Probes | null = null;

function probes(): Probes {
  const root = document.documentElement;
  const dark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const key = `${root.dataset.theme ?? ''}|${root.dataset.accent ?? ''}|${root.dataset.color ?? ''}|${dark}`;
  if (cached?.key === key) return cached;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const read = (token: string): string => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  };
  cached = { key, primary: read('--text'), muted: [read('--text-muted'), read('--text-3')] };
  probe.remove();
  return cached;
}

/** Classifies a computed `color` value against the current theme's text tokens. */
export function inkOf(computedColor: string): Ink {
  const p = probes();
  if (computedColor === p.primary) return 'p';
  return p.muted.includes(computedColor) ? 'm' : 'o';
}
