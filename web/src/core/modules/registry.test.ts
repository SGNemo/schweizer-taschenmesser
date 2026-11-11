import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allManifests, availableManifestsFor, isAvailableOn, validateManifest } from './registry';
import {
  CARD_SHAPES,
  HEAD_VARIANTS,
  MODULE_HUES,
  SIGNATURES,
  SIGNATURE_SLOTS,
  SLOT_SIZES,
  TYPE_ACCENTS,
  WIDGET_VARIANTS,
  AREAS,
} from './types';
import { checkIdentity, type IdentityFacts } from '../../../scripts/lib/checkIdentity';

describe('module registry', () => {
  it('discovers manifests', () => {
    expect(allManifests.length).toBeGreaterThan(0);
    expect(new Set(allManifests.map((m) => m.id)).size).toBe(allManifests.length);
  });

  it.each(allManifests.map((m) => [m.id, m] as const))('manifest "%s" is valid', (_id, m) => {
    expect(validateManifest(m)).toEqual([]);
  });

  it('retired modules: stripped manifest is valid, leftovers are rejected, never listed', () => {
    const base = allManifests.find((m) => m.id === 'todos')!;
    const retired = {
      ...base,
      id: 'gone',
      retired: true as const,
      routes: [],
      widgets: [],
      aiSchema: undefined,
      area: undefined,
      contributions: undefined,
      defaultEnabled: false,
      seed: { version: 1, dependsOn: [], none: 'retired' as const },
    };
    expect(validateManifest(retired)).toEqual([]);
    expect(validateManifest({ ...retired, area: 'plan' })).toHaveLength(1);
    expect(validateManifest({ ...retired, seed: base.seed })).toHaveLength(1);
    expect(validateManifest({ ...retired, routes: base.routes }).length).toBeGreaterThan(0);
    // A retired module offers nothing to the planner either (contributions must be absent).
    expect(
      validateManifest({
        ...retired,
        contributions: { plannable: async () => ({ default: { list: async () => [] } }) },
      }),
    ).toHaveLength(1);
    // A normal module still needs an area.
    expect(validateManifest({ ...base, area: undefined })).toHaveLength(1);
    // Retired ids stay in allManifests (schema, sync, backup) but never reach runtime lists.
    for (const m of allManifests.filter((x) => x.retired))
      expect(availableManifestsFor('desktop').map((x) => x.id)).not.toContain(m.id);
  });

  it('requires an identity with a palette hue; the fields dropped in v3.1 are refused', () => {
    const base = allManifests[0]!;
    expect(validateManifest({ ...base, identity: undefined as never })).toHaveLength(1);
    expect(
      validateManifest({ ...base, identity: { ...base.identity, hue: 'mauve' as never } }),
    ).toHaveLength(1);
    for (const key of ['widgetType', 'feedback'])
      expect(
        validateManifest({ ...base, identity: { ...base.identity, [key]: 'kpi' } as never }),
        key,
      ).toHaveLength(1);
  });

  it('identity v3: widget, head and signature are required and checked; the optional fields too', () => {
    const base = allManifests.find((m) => m.id === 'finance')!;
    const bad = (patch: Record<string, unknown>) =>
      validateManifest({ ...base, identity: { ...base.identity, ...patch } as never });
    expect(validateManifest(base)).toEqual([]);
    for (const patch of [
      { head: 'banner' },
      { head: 'figure' },
      // Identity 4.0: the nine silhouettes of identity v3 are no head variants any more.
      { head: 'kennzahl' },
      { head: undefined },
      { widget: 'chart' },
      { widget: undefined },
      { signature: 'spaceship' },
      { signature: undefined },
      { hue: 'plum' },
      { hue2: 'pink' },
      { hue2: base.identity.hue },
      { type: 'comic' },
      { shape: 'blob' },
    ])
      expect(bad(patch), JSON.stringify(patch)).toHaveLength(1);
    expect(bad({ hue2: 'sky', type: 'thin', shape: 'round' })).toEqual([]);
    // A widget may name its own shape; an unknown one is refused.
    const widgets = (variant: string) =>
      base.widgets.map((w) => ({ ...w, variant: variant as never }));
    expect(validateManifest({ ...base, widgets: widgets('fokus') })).toEqual([]);
    expect(validateManifest({ ...base, widgets: widgets('blob') }).length).toBeGreaterThan(0);
  });

  it('every module declares an identity v3 from the fixed lists', () => {
    for (const m of allManifests.filter((x) => !x.retired)) {
      expect(HEAD_VARIANTS, m.id).toContain(m.identity.head);
      expect(WIDGET_VARIANTS, m.id).toContain(m.identity.widget);
      expect(SIGNATURES, m.id).toContain(m.identity.signature);
    }
  });

  it('Identity 4.0: two head variants; the stage is the exception, at most one module per area (weather, music)', () => {
    expect([...HEAD_VARIANTS]).toEqual(['standard', 'stage']);
    const live = allManifests.filter((x) => !x.retired);
    const stages = live.filter((m) => m.identity.head === 'stage');
    expect(stages.map((m) => m.id).sort()).toEqual(['music', 'weather']);
    for (const area of AREAS)
      expect(
        stages.filter((m) => m.area === area).length,
        `more than one stage head in ${area}`,
      ).toBeLessThanOrEqual(1);
    // The head no longer tells neighbours apart; hue and signature do: no two modules of an area share either.
    for (const area of AREAS) {
      const group = live.filter((m) => m.area === area);
      const signatures = group.map((m) => m.identity.signature);
      expect(new Set(signatures).size, `signatures in ${area}`).toBe(signatures.length);
      expect(signatures, area).not.toContain('none');
    }
  });

  it('Identity 4.0: the app-wide rules hold on the runtime registry (same facts as npm run check:modules)', () => {
    const facts: IdentityFacts[] = allManifests.map((m) => ({
      id: m.id,
      area: m.area,
      order: m.order ?? 100,
      hue: m.identity.hue,
      hue2: m.identity.hue2,
      head: m.identity.head,
      widget: m.identity.widget,
      signature: m.identity.signature,
      retired: !!m.retired,
    }));
    expect(checkIdentity(facts)).toEqual([]);
    // Every head variant names the size of its signature slot: the standard head has none, the stage is the slot.
    for (const head of HEAD_VARIANTS)
      expect([...SLOT_SIZES, 'none'], head).toContain(SIGNATURE_SLOTS[head]);
    expect(SIGNATURE_SLOTS).toEqual({ standard: 'none', stage: 'L' });
  });

  it('no two modules of one navigation area share a hue (the palette has ten; areas are small)', () => {
    const seen = new Map<string, string>();
    for (const m of allManifests.filter((x) => !x.retired && x.area)) {
      const key = `${m.area}:${m.identity.hue}`;
      expect(
        seen.get(key),
        `${m.id} and ${seen.get(key)} share "${m.identity.hue}" in ${m.area}`,
      ).toBeUndefined();
      seen.set(key, m.id);
    }
  });

  it('the static checker (npm run check:modules) knows the same hues and widget types', async () => {
    const lib = await import('../../../scripts/lib/checkModules');
    expect(lib.HUES).toEqual([...MODULE_HUES]);
    expect(lib.HEAD_VARIANTS).toEqual([...HEAD_VARIANTS]);
    expect(lib.WIDGET_VARIANTS).toEqual([...WIDGET_VARIANTS]);
    expect(lib.SIGNATURES).toEqual([...SIGNATURES]);
    expect(lib.TYPE_ACCENTS).toEqual([...TYPE_ACCENTS]);
    expect(lib.CARD_SHAPES).toEqual([...CARD_SHAPES]);
  });

  it('rejects bad manifests', () => {
    const bad = { ...allManifests[0]!, id: 'Bad-Id', version: 0 };
    expect(validateManifest(bad).length).toBeGreaterThanOrEqual(2);
  });

  it('validates the page layout of a module and its routes', () => {
    const base = allManifests[0]!;
    expect(validateManifest({ ...base, layout: 'wide' })).toEqual([]);
    expect(validateManifest({ ...base, layout: 'huge' as never })).toHaveLength(1);
    const routes = base.routes.map((r) => ({ ...r, layout: 'tiny' as never }));
    expect(validateManifest({ ...base, routes })).toHaveLength(routes.length);
  });

  it('validates the platforms of a module', () => {
    const base = allManifests[0]!;
    expect(validateManifest({ ...base, platforms: ['desktop'] })).toEqual([]);
    expect(validateManifest({ ...base, platforms: ['ios' as never] })).toHaveLength(1);
    expect(validateManifest({ ...base, platforms: [] })).toHaveLength(1);
  });

  it('filters by platform; a missing field means everywhere', () => {
    const base = allManifests[0]!;
    expect(isAvailableOn(base, 'android')).toBe(base.platforms?.includes('android') ?? true);
    const desktopOnly = { ...base, platforms: ['desktop' as const] };
    expect(isAvailableOn(desktopOnly, 'desktop')).toBe(true);
    expect(isAvailableOn(desktopOnly, 'android')).toBe(false);
    expect(isAvailableOn(desktopOnly, 'web')).toBe(false);
    expect(isAvailableOn({ ...base, platforms: undefined }, 'web')).toBe(true);
  });

  it('availableManifests keeps every all-platform module', () => {
    const web = availableManifestsFor('web');
    for (const m of allManifests.filter((x) => !x.platforms && !x.devOnly && !x.retired))
      expect(web).toContain(m);
  });
});

/**
 * Isolation rule: modules never import each other. Only finance may import the public.ts of
 * subscriptions and invoices, and budgets the public.ts of finance. Checked on the real source files (relative + alias imports).
 */
describe('module isolation', () => {
  const modulesDir = resolve(process.cwd(), 'src/modules');
  const importRe = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
    });
  }

  const allowed: Record<string, string[]> = {
    finance: ['subscriptions/public', 'invoices/public'],
    budgets: ['finance/public'],
  };

  for (const id of readdirSync(modulesDir).filter((e) =>
    statSync(join(modulesDir, e)).isDirectory(),
  )) {
    it(`module "${id}" imports no other module`, () => {
      const violations: string[] = [];
      for (const file of files(join(modulesDir, id))) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(importRe)) {
          const spec = m[1]!;
          let target: string | undefined;
          if (spec.startsWith('@/modules/')) target = spec.slice('@/modules/'.length);
          else if (spec.startsWith('.')) {
            const abs = resolve(dirname(file), spec);
            if (abs.startsWith(modulesDir))
              target = abs.slice(modulesDir.length + 1).replaceAll('\\', '/');
          }
          if (!target) continue;
          const [targetId] = target.split('/');
          if (targetId === id) continue;
          if (allowed[id]?.some((a) => target!.startsWith(a))) continue;
          violations.push(`${file}: ${spec}`);
        }
      }
      expect(violations).toEqual([]);
    });
  }
});
