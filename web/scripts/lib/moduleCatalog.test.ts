import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HEAD_VARIANTS, HUES, WIDGET_VARIANTS } from './checkModules';

/**
 * The website's module catalogue (`npm run gen:modules`) carries the identity of every module, so the site
 * draws colour, head and widget shape without a second mapping. A module without them would render grey
 * and shapeless there.
 */
const catalog = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../site/src/catalog/modules.json', import.meta.url)),
    'utf8',
  ),
) as {
  modules: {
    id: string;
    icon: string;
    hue: string;
    hue2: string | null;
    head: string;
    widget: string;
  }[];
};

describe('site/src/catalog/modules.json', () => {
  it('lists modules', () => {
    expect(catalog.modules.length).toBeGreaterThan(10);
  });
  it.each(catalog.modules.map((m) => [m.id, m] as const))('%s carries its identity', (_id, m) => {
    expect(HUES).toContain(m.hue);
    if (m.hue2 !== null) expect(HUES).toContain(m.hue2);
    expect(HEAD_VARIANTS).toContain(m.head);
    expect(WIDGET_VARIANTS).toContain(m.widget);
    expect(m.icon).toMatch(/^[a-zA-Z]+$/);
  });
});
