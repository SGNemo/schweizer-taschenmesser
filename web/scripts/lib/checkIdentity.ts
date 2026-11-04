/**
 * Cross-module identity checks of `npm run check:modules` (identity v3, docs/design/identity-v3/02-CONCEPT.md § 4):
 * inside one navigation area no two modules share a hue, the hues keep their distance, and two neighbours
 * (in the order of the navigation) never share a head variant. Works on manifest source text and `tokens.css`,
 * so it runs without a build; `src/core/modules/registry.test.ts` is the runtime counterpart.
 */

export interface IdentityFacts {
  id: string;
  area?: string;
  /** `manifest.order`, default 100 (the navigation's sort key). */
  order: number;
  hue?: string;
  hue2?: string;
  head?: string;
  widget?: string;
  retired: boolean;
}

/** Reads what the group checks need from a manifest's source text. */
export function identityFacts(id: string, manifest: string): IdentityFacts {
  const identity = /\bidentity:\s*\{([^}]*)\}/.exec(manifest)?.[1] ?? '';
  const pick = (key: string) =>
    new RegExp(`\\b${key}:\\s*['"]([a-zA-Z0-9]+)['"]`).exec(identity)?.[1];
  return {
    id,
    area: /^\s{2}area:\s*['"]([a-z]+)['"]/m.exec(manifest)?.[1],
    order: Number(/^\s{2}order:\s*(\d+)/m.exec(manifest)?.[1] ?? 100),
    hue: pick('hue'),
    hue2: pick('hue2'),
    head: pick('head'),
    widget: pick('widget'),
    retired: /\bretired:\s*true/.test(manifest),
  };
}

/** HSL hue angle (0–360) of `#rrggbb`: the measure `tokens.test.ts` uses between hues and state colours. */
export function hueAngle(hex: string): number {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => Number.parseInt(h, 16) / 255);
  const max = Math.max(r!, g!, b!);
  const d = max - Math.min(r!, g!, b!);
  if (d === 0) return 0;
  const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return (h * 60 + 360) % 360;
}

export const MIN_HUE_DISTANCE = 25;

/** `--mod-<hue>: #hex` of the light theme (first `:root` block) and the dark theme (`:root[data-theme='dark']`). */
export function readHueTable(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const grab = (from: number): Record<string, string> => {
    const out: Record<string, string> = {};
    const end = css.indexOf('\n}', from);
    for (const m of css.slice(from, end).matchAll(/--mod-([a-z]+):\s*(#[0-9a-f]{6});/g))
      out[m[1]!] = m[2]!;
    return out;
  };
  return {
    light: grab(css.indexOf(':root {\n  --font-sans')),
    dark: grab(css.indexOf(":root[data-theme='dark']")),
  };
}

/** The problems of one area group; modules without an area and retired ones are not part of any group. */
export function checkIdentityGroups(
  facts: readonly IdentityFacts[],
  table: { light: Record<string, string>; dark: Record<string, string> },
): string[] {
  const errors: string[] = [];
  const areas = new Map<string, IdentityFacts[]>();
  for (const f of facts) {
    if (f.retired || !f.area) continue;
    areas.set(f.area, [...(areas.get(f.area) ?? []), f]);
  }
  for (const [area, group] of areas) {
    const sorted = [...group].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const byHue = new Map<string, string>();
    for (const f of sorted) {
      if (!f.hue) continue;
      const other = byHue.get(f.hue);
      if (other) errors.push(`${f.id} and ${other} share the hue "${f.hue}" in the area "${area}"`);
      else byHue.set(f.hue, f.id);
    }
    for (const [theme, hues] of Object.entries(table))
      for (const [i, a] of sorted.entries())
        for (const b of sorted.slice(i + 1)) {
          if (!a.hue || !b.hue || a.hue === b.hue || a.hue === 'slate' || b.hue === 'slate')
            continue;
          const ha = hues[a.hue];
          const hb = hues[b.hue];
          if (!ha || !hb) continue;
          const d = Math.abs(hueAngle(ha) - hueAngle(hb));
          if (Math.min(d, 360 - d) < MIN_HUE_DISTANCE)
            errors.push(
              `${a.id} (${a.hue}) and ${b.id} (${b.hue}) are less than ${MIN_HUE_DISTANCE}° of hue apart in ${theme} (area "${area}")`,
            );
        }
    for (const [i, f] of sorted.entries()) {
      const next = sorted[i + 1];
      if (next && f.head && f.head === next.head)
        errors.push(
          `${f.id} and ${next.id} are neighbours in the area "${area}" and share the head variant "${f.head}"`,
        );
    }
  }
  return errors;
}
