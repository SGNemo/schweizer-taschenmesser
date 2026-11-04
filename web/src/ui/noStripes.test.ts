import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Identity v3 rule (docs/design/identity-v3/02-CONCEPT.md § 2, MODULE-IDENTITY.md): no coloured stripe on an edge for
 * identity or urgency. Accent is a plate, a tinted head, a hairline all around, a surface tint or a filled chip. A neutral
 * 2–3 px bar (a quote, a timeline rail, a table-of-contents rail in `--border` / `--text-3`) is structural and stays.
 */
const SRC = resolve(__dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

/** Colour sources that carry identity or state; a left edge may never use them. */
const COLOURED =
  /var\(--(?:module-color|mod-[a-z]+|area-color|accent|danger|warning|success|info|kind|cat-\d|tone|stripe|viz-\d)\b/;
const NEUTRAL_ONLY = /var\(--(?:border|border-strong|text-3|text-muted)\)/;

interface Hit {
  file: string;
  selector: string;
  declaration: string;
}

function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g))
    out.push({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]! });
  return out;
}

export function findStripes(file: string, css: string): Hit[] {
  const hits: Hit[] = [];
  for (const { selector, body } of rules(css)) {
    const decls = body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean);
    for (const d of decls) {
      // border-left / border-inline-start (shorthand, colour, width): a coloured one is a stripe.
      const edge = /^(?:border-left|border-inline-start)(?:-color|-width)?\s*:\s*(.+)$/.exec(d);
      if (edge) {
        const value = edge[1]!;
        if (/-width\s*:/.test(d) && !/^border-(?:left|inline-start)-width/.test(d)) continue;
        if (COLOURED.test(value) || /^border-(?:left|inline-start)-width/.test(d))
          hits.push({ file, selector, declaration: d });
        else if (!NEUTRAL_ONLY.test(value) && /\d+px\s+solid\s+(?:#|rgb|hsl)/.test(value))
          hits.push({ file, selector, declaration: d });
      }
    }
    // A bar element 2-4 px wide and taller than a dot in a colour from the sources above (a "stripe" element).
    if (
      /\bwidth\s*:\s*[234]px\b/.test(body) &&
      /\bheight\s*:\s*(?:\d*\.?\d+(?:em|rem)|100%)\b/.test(body) &&
      /background(?:-color)?\s*:[^;]*var\(--(?:module-color|mod-[a-z]+|area-color|accent|danger|warning|success|cat-\d)\b/.test(
        body,
      )
    )
      hits.push({ file, selector, declaration: 'thin coloured bar element' });
    // A thin absolutely positioned bar at an edge (::before/::after) in a colour from the sources above.
    if (/::(?:before|after)/.test(selector)) {
      const left = /\b(?:left|inset-inline-start)\s*:\s*0\b/.test(body);
      const thin = /\bwidth\s*:\s*[234]px\b/.test(body);
      const colour = COLOURED.test(body);
      if (left && thin && colour)
        hits.push({ file, selector, declaration: 'thin coloured bar at the left edge' });
    }
  }
  return hits;
}

describe('no identity or urgency stripes (identity v3)', () => {
  it('detects the stripe patterns it is meant to forbid', () => {
    expect(findStripes('x.css', '.a { border-left: 4px solid var(--module-color); }')).toHaveLength(
      1,
    );
    expect(findStripes('x.css', '.a { border-left-width: 4px; }')).toHaveLength(1);
    expect(findStripes('x.css', '.a { border-left-color: var(--danger); }')).toHaveLength(1);
    expect(
      findStripes('x.css', '.a { border-inline-start: 3px solid var(--accent); }'),
    ).toHaveLength(1);
    expect(
      findStripes(
        'x.css',
        '.a::before { content: ""; position: absolute; left: 0; width: 3px; background: var(--area-color); }',
      ),
    ).toHaveLength(1);
    // Neutral structure stays: a quote bar, a timeline rail, a grid hairline.
    expect(findStripes('x.css', '.q { border-left: 3px solid var(--border-strong); }')).toEqual([]);
    expect(findStripes('x.css', '.t { border-left: 2px solid var(--border); }')).toEqual([]);
    expect(findStripes('x.css', '.g { border-left: 1px solid var(--border); }')).toEqual([]);
    // A hairline all around in a hue is fine.
    expect(findStripes('x.css', '.c { border: 1px solid var(--module-color); }')).toEqual([]);
  });

  it('no stylesheet of the app has one', () => {
    const hits = cssFiles(SRC).flatMap((f) =>
      findStripes(relative(SRC, f), readFileSync(f, 'utf8')),
    );
    expect(
      hits.map((h) => `${h.file}: ${h.selector} { ${h.declaration} }`),
      'coloured edge stripes found: use a plate, a tint, a hairline all around or a filled chip',
    ).toEqual([]);
  });
});
