/**
 * Cross-module identity checks (identity v3.1, docs/design/MODULE-IDENTITY.md "Rules"): inside one navigation
 * area no two modules share a hue and two neighbours (in the order of the navigation) never share a head
 * variant; app-wide two modules with the same hue never share head *and* widget, and a shared head or widget needs
 * a signature of its own. Pure functions over
 * facts: `npm run check:modules` reads them from the manifest source (no build), `src/core/modules/registry.test.ts`
 * from the runtime registry, so both see the same rule. The palette pins every pair of hues at ≥ 26°
 * (`ui/tokens.test.ts`), so "25° apart" is the same as "a different hue" and no angle is computed here.
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
  signature?: string;
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
    signature: pick('signature'),
    retired: /\bretired:\s*true/.test(manifest),
  };
}

/** The problems of one area group; modules without an area and retired ones are not part of any group. */
export function checkIdentityGroups(facts: readonly IdentityFacts[]): string[] {
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

/** A signature that tells two modules apart: a drawing of its own, so never `none` and never the same. */
const ownSignature = (a: IdentityFacts, b: IdentityFacts): boolean =>
  !!a.signature && !!b.signature && a.signature !== 'none' && b.signature !== 'none'
    ? a.signature !== b.signature
    : false;

/**
 * App-wide collisions (the overview, the sidebar and the library show every area side by side):
 * same hue ⇒ head and widget never both the same, and a shared head or widget needs a signature of its own
 * (so one widget shape on one hue needs another head). Retired modules take no part.
 */
export function checkIdentityCollisions(facts: readonly IdentityFacts[]): string[] {
  const errors: string[] = [];
  const live = facts.filter((f) => !f.retired).sort((a, b) => a.id.localeCompare(b.id));
  for (const [i, a] of live.entries())
    for (const b of live.slice(i + 1)) {
      const pair = `${a.id} and ${b.id}`;
      if (a.hue && a.hue === b.hue) {
        const head = !!a.head && a.head === b.head;
        const widget = !!a.widget && a.widget === b.widget;
        if (head && widget)
          errors.push(
            `${pair} share the hue "${a.hue}", the head "${a.head}" and the widget "${a.widget}" (app-wide rule: differ in head or widget)`,
          );
        else if ((head || widget) && !ownSignature(a, b))
          errors.push(
            `${pair} share the hue "${a.hue}" and the ${head ? `head "${a.head}"` : `widget "${a.widget}"`}; each needs a signature of its own (not "none", not the same)`,
          );
      }
    }
  return errors;
}

/** Every identity rule over one set of facts. */
export const checkIdentity = (facts: readonly IdentityFacts[]): string[] => [
  ...checkIdentityGroups(facts),
  ...checkIdentityCollisions(facts),
];

/**
 * A module whose identity says `signature: 'none'` but whose page fills the signature slot (`HeroSlot
 * area="signature"`) most likely forgot to name its signature: a warning (the checker prints it, the build stays green).
 */
export function checkSignatureUse(
  id: string,
  manifest: string,
  pageSources: readonly string[],
): string[] {
  const facts = identityFacts(id, manifest);
  if (facts.retired || facts.signature !== 'none') return [];
  return pageSources.some((s) => /<HeroSlot\b[^>]*\barea=\{?["']signature["']\}?/.test(s))
    ? [
        `${id}: identity.signature is "none" but the page fills the signature slot – name the signature (SIGNATURES) so the frame and the settings head show it`,
      ]
    : [];
}

/**
 * C11: type weights come from the tokens (`--weight-*` in `ui/tokens.css`), never a raw number, so a weight
 * change is one edit and no module invents its own (550, 650 …). `@font-face` ranges (`100 900`) describe the
 * font file and stay. `tokens.css` itself defines the numbers and is not passed in.
 */
export function checkFontWeights(file: string, css: string): string[] {
  const out: string[] = [];
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const faces = [...plain.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => [
    m.index,
    m.index + m[0].length,
  ]);
  for (const m of plain.matchAll(/font-weight\s*:\s*(\d+)/g)) {
    if (faces.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const line = plain.slice(0, m.index).split('\n').length;
    out.push(`${file}:${line}: font-weight ${m[1]} – use a token (var(--weight-…)) or "normal"`);
  }
  return out;
}
