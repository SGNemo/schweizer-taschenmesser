import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '../../../scripts/lib/checkModules';
import { validateManifest } from './registry';
import { allManifests } from './registry';
import { PAGE_LAYOUTS, type ModuleManifest } from './types';

/**
 * Page layouts (`manifest.layout`), Identity 4.0 package 0b-1: `reading` and `split` join the four widths. One list
 * in three places (the type, `check:modules`, the container's stylesheet), kept in step here.
 */
const SRC = resolve(__dirname, '../..');
const read = (rel: string): string =>
  readFileSync(resolve(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (css: string, selector: string): string | undefined =>
  new RegExp(
    `(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
  ).exec(css)?.[1];

describe('page layouts', () => {
  it('reading and split are layouts, next to the four widths', () => {
    expect([...PAGE_LAYOUTS].sort()).toEqual(
      ['content', 'full', 'narrow', 'reading', 'split', 'wide'].sort(),
    );
  });

  it('check:modules knows the same layouts as the type', () => {
    expect([...LAYOUTS].sort()).toEqual([...PAGE_LAYOUTS].sort());
  });

  it('the registry accepts them for a module and for a route, and still refuses an unknown one', () => {
    const base = allManifests.find((m) => !m.retired && m.routes.length > 0)!;
    for (const layout of ['reading', 'split'] as const) {
      expect(validateManifest({ ...base, layout }), layout).toEqual([]);
      const routes = base.routes.map((r) => ({ ...r, layout }));
      expect(validateManifest({ ...base, routes }), `route ${layout}`).toEqual([]);
    }
    expect(validateManifest({ ...base, layout: 'huge' } as unknown as ModuleManifest)).toHaveLength(
      1,
    );
  });

  it('the page container has a width for every layout; reading is the reading measure, split the page width', () => {
    const css = read('layout/PageContainer.module.css');
    for (const layout of PAGE_LAYOUTS)
      expect(rule(css, `.${layout}`), `.${layout} in PageContainer.module.css`).toMatch(
        /max-width:/,
      );
    expect(rule(css, '.reading')).toMatch(/max-width:\s*var\(--page-reading\)/);
    expect(rule(css, '.split')).toMatch(/max-width:\s*var\(--page-wide\)/);
  });

  it('the module head follows the container for both new layouts', () => {
    const css = read('layout/AreaFrame.module.css');
    expect(rule(css, ".inner[data-width='reading']")).toMatch(/var\(--page-reading\)/);
    expect(css).toMatch(
      /\.inner\[data-width='wide'\],\s*\.inner\[data-width='split'\]\s*\{[^}]*var\(--page-wide\)/,
    );
  });

  it('the detail panel of a split page is the token of DESIGN-SPEC § 2', () => {
    expect(read('ui/Patterns.module.css')).toMatch(
      /\.splitView \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--split-detail\)/,
    );
  });
});
