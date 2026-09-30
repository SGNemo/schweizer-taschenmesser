import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allManifests, validateManifest } from './registry';

describe('module registry', () => {
  it('discovers manifests', () => {
    expect(allManifests.length).toBeGreaterThan(0);
    expect(new Set(allManifests.map((m) => m.id)).size).toBe(allManifests.length);
  });

  it.each(allManifests.map((m) => [m.id, m] as const))('manifest "%s" is valid', (_id, m) => {
    expect(validateManifest(m)).toEqual([]);
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
