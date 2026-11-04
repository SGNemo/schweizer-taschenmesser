import { describe, expect, it } from 'vitest';
import { AREAS, MODULE_HUES } from '@/core/modules/types';
import { SETTINGS_CATEGORY_IDS } from '@/core/settings/registry/types';
import { CATEGORY_LOOK, NAV_GROUPS } from './categoryLook';

describe('settings category look', () => {
  it('every category has a look with a known hue and area', () => {
    for (const id of SETTINGS_CATEGORY_IDS) {
      const look = CATEGORY_LOOK[id];
      expect(look, id).toBeDefined();
      expect(MODULE_HUES).toContain(look.hue);
      expect(AREAS).toContain(look.area);
    }
  });

  it('neighbours in the list never share a hue (slate excepted)', () => {
    SETTINGS_CATEGORY_IDS.forEach((id, i) => {
      const next = SETTINGS_CATEGORY_IDS[i + 1];
      if (!next) return;
      const a = CATEGORY_LOOK[id].hue;
      if (a !== 'slate') expect(CATEGORY_LOOK[next].hue, `${id} / ${next}`).not.toBe(a);
    });
  });

  it('the nav groups list every category exactly once, in registry order', () => {
    const flat = NAV_GROUPS.flatMap((g) => g.categories);
    expect(flat).toEqual([...SETTINGS_CATEGORY_IDS]);
  });
});
