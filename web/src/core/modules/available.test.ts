import { describe, expect, it } from 'vitest';
import { isAvailableOn, passesBuild } from './registry';
import { catalogManifests, isVisible } from './available';
import type { Maturity, ModuleManifest } from './types';
import type { PlatformKind } from '@/core/platform/types';

const base = (over: Partial<ModuleManifest>): ModuleManifest =>
  ({
    id: 'x',
    name: 'X',
    icon: 'grid',
    version: 1,
    description: '',
    routes: [],
    dataSchema: { collections: {} },
    migrations: {},
    widgets: [],
    settings: { fields: [], defaults: {} },
    defaultEnabled: false,
    maturity: 'stable',
    seed: { version: 1, dependsOn: [] },
    ...over,
  }) as ModuleManifest;

/** The whole filter chain as the app applies it: build → platform → maturity (catalogues only). */
function listed(
  m: ModuleManifest,
  o: { devOnlyIncluded: boolean; platform: PlatformKind; showPreview: boolean; enabled: boolean },
) {
  return (
    passesBuild(m, o.devOnlyIncluded) &&
    isAvailableOn(m, o.platform) &&
    isVisible(m, { showPreview: o.showPreview, isEnabled: () => o.enabled })
  );
}

describe('module visibility filter', () => {
  it('every combination of retired, devOnly, platforms, maturity, showPreview and enabled', () => {
    const bools = [false, true] as const;
    const platformsOptions: (PlatformKind[] | undefined)[] = [undefined, ['desktop']];
    const maturities: Maturity[] = ['stable', 'preview'];
    let cases = 0;
    for (const retired of bools)
      for (const devOnly of bools)
        for (const platforms of platformsOptions)
          for (const maturity of maturities)
            for (const devOnlyIncluded of bools)
              for (const platform of ['web', 'desktop'] as const)
                for (const showPreview of bools)
                  for (const enabled of bools) {
                    const m = base({
                      ...(retired ? { retired: true } : {}),
                      ...(devOnly ? { devOnly: true } : {}),
                      ...(platforms ? { platforms } : {}),
                      maturity,
                    });
                    const expected =
                      !retired &&
                      (!devOnly || devOnlyIncluded) &&
                      (!platforms || platforms.includes(platform)) &&
                      (maturity === 'stable' || showPreview || enabled);
                    expect(
                      listed(m, { devOnlyIncluded, platform, showPreview, enabled }),
                      JSON.stringify({
                        retired,
                        devOnly,
                        platforms,
                        maturity,
                        devOnlyIncluded,
                        platform,
                        showPreview,
                        enabled,
                      }),
                    ).toBe(expected);
                    cases++;
                  }
    expect(cases).toBe(256);
  });

  it('a preview module the user switched on stays listed with the switch off', () => {
    const m = base({ maturity: 'preview' });
    expect(isVisible(m, { showPreview: false })).toBe(false);
    expect(isVisible(m, { showPreview: false, isEnabled: () => false })).toBe(false);
    expect(isVisible(m, { showPreview: false, isEnabled: (id) => id === 'x' })).toBe(true);
    expect(isVisible(m, { showPreview: true })).toBe(true);
    // Stable modules never depend on the switch or the state.
    expect(isVisible(base({}), { showPreview: false, isEnabled: () => false })).toBe(true);
  });

  it('catalogManifests only ever narrows availableManifests and does not reorder it', () => {
    const all = catalogManifests({ showPreview: true });
    const narrow = catalogManifests({ showPreview: false });
    expect(narrow.every((m) => all.includes(m))).toBe(true);
    expect(all.filter((m) => m.maturity === 'stable')).toEqual(
      narrow.filter((m) => m.maturity === 'stable'),
    );
  });
});
