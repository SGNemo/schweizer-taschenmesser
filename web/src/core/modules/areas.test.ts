// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { allManifests, validateManifest } from './registry';
import {
  areaOfPath,
  areaTarget,
  AREA_PATHS,
  buildNavTree,
  DEFAULT_FAVOURITES,
  MAX_FAVOURITES,
  rememberAreaModule,
  resolveFavourites,
} from './areas';
import { AREAS, type AreaId, type ModuleManifest } from './types';

const mod = (id: string, area: AreaId, order: number, nav = true): ModuleManifest =>
  ({
    id,
    name: id,
    icon: 'puzzle',
    area,
    order,
    routes: [{ path: `/${id}`, label: id, nav, component: async () => ({ default: () => null }) }],
  }) as unknown as ModuleManifest;

const manifests = [
  mod('calendar', 'plan', 10),
  mod('todos', 'plan', 20),
  mod('finance', 'money', 40),
  mod('invoices', 'money', 50),
  mod('notes', 'knowledge', 80),
  mod('accounts', 'vault', 160),
];
const all = Object.fromEntries(manifests.map((m) => [m.id, true]));

describe('areas', () => {
  it('every manifest declares a known area; unknown ones are rejected', () => {
    for (const m of allManifests.filter((x) => !x.retired)) expect(AREAS, m.id).toContain(m.area);
    for (const m of allManifests.filter((x) => x.retired)) expect(m.area, m.id).toBeUndefined();
    expect(validateManifest({ ...allManifests[0]!, area: 'nope' as AreaId })).toHaveLength(1);
  });

  it('every area has a path', () => {
    expect(Object.keys(AREA_PATHS).sort()).toEqual([...AREAS].sort());
  });

  it('groups enabled modules by area in manifest order and hides empty areas', () => {
    const tree = buildNavTree(manifests, { ...all, notes: false, accounts: false }, undefined);
    expect(tree.areas.map((a) => a.id)).toEqual(['plan', 'money']);
    expect(tree.areas[0]!.items.map((i) => i.to)).toEqual(['/calendar', '/todos']);
  });

  it('modules without a nav route do not show up', () => {
    const tree = buildNavTree([mod('quiet', 'plan', 1, false)], { quiet: true }, undefined);
    expect(tree.areas).toEqual([]);
  });

  it('defaults to calendar, todos and finance (only the enabled ones)', () => {
    expect(buildNavTree(manifests, all, undefined).favourites.map((i) => i.moduleId)).toEqual([
      ...DEFAULT_FAVOURITES,
    ]);
    expect(
      buildNavTree(manifests, { ...all, todos: false }, undefined).favourites.map(
        (i) => i.moduleId,
      ),
    ).toEqual(['calendar', 'finance']);
  });

  it('keeps the stored favourites: order, no duplicates, no disabled or unknown ids, at most five', () => {
    const enabled = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(resolveFavourites(['c', 'a', 'a', 'zzz', 'b'], enabled)).toEqual(['c', 'a', 'b']);
    expect(resolveFavourites(['a', 'b', 'c', 'd', 'e', 'f', 'g'], enabled)).toHaveLength(
      MAX_FAVOURITES,
    );
    expect(resolveFavourites([], enabled)).toEqual([]);
  });

  describe('area pages', () => {
    beforeEach(() => localStorage.clear());
    const area = () => buildNavTree(manifests, all, undefined).areas.find((a) => a.id === 'money')!;

    it('lead to the first module, then to the one used last (if still enabled)', () => {
      expect(areaTarget(area())).toBe('/finance');
      rememberAreaModule('money', '/invoices');
      expect(areaTarget(area())).toBe('/invoices');
      rememberAreaModule('money', '/gone');
      expect(areaTarget(area())).toBe('/finance');
    });

    it('finds the area of a path, including sub-routes', () => {
      const tree = buildNavTree(manifests, all, undefined);
      expect(areaOfPath(tree, '/invoices')?.id).toBe('money');
      expect(areaOfPath(tree, '/invoices/42')?.id).toBe('money');
      expect(areaOfPath(tree, '/settings')).toBeUndefined();
      expect(areaOfPath(tree, '/invoicesx')).toBeUndefined();
    });
  });
});
