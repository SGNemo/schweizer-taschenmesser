import { describe, expect, it } from 'vitest';
import { checkModule, checkSettingsSource, checkWidgetSource } from './checkModules';

const good = `
const manifest = {
  id: 'x',
  widgets: [
    { id: 'a', title: 'A', defaultSize: 's', sizes: ALL_WIDGET_SIZES, component: () => import('./widgets/AWidget') },
  ],
  layout: 'wide',
  platforms: ['desktop'],
  seed: { version: 1, dependsOn: [] },
};`;
const has =
  (...files: string[]) =>
  (rel: string) =>
    files.includes(rel);

describe('checkModule', () => {
  it('accepts a complete manifest', () => {
    expect(
      checkModule({ id: 'x', manifest: good, fileExists: has('widgets/AWidget.tsx', 'seed.ts') }),
    ).toEqual([]);
  });

  it('fails without a widget (error, not a warning)', () => {
    const m = good.replace(/widgets: \[[\s\S]*?\],\n {2}layout/, 'widgets: [],\n  layout');
    expect(checkModule({ id: 'x', manifest: m, fileExists: has() }).join()).toContain('no widget');
  });

  it('fails when the widget file is missing or the sizes are not declared', () => {
    expect(checkModule({ id: 'x', manifest: good, fileExists: has() }).join()).toContain('missing');
    const m = good.replace('sizes: ALL_WIDGET_SIZES, ', '');
    expect(
      checkModule({
        id: 'x',
        manifest: m,
        fileExists: has('widgets/AWidget.tsx', 'seed.ts'),
      }).join(),
    ).toContain('`sizes`');
  });

  it('requires a layout (except dev-only modules) and valid platforms', () => {
    const f = has('widgets/AWidget.tsx', 'seed.ts');
    expect(
      checkModule({ id: 'x', manifest: good.replace("layout: 'wide',", ''), fileExists: f }),
    ).toHaveLength(1);
    expect(
      checkModule({
        id: 'x',
        manifest: good.replace("layout: 'wide',", 'devOnly: true,'),
        fileExists: f,
      }),
    ).toEqual([]);
    expect(
      checkModule({ id: 'x', manifest: good.replace('desktop', 'ios'), fileExists: f }),
    ).toHaveLength(1);
    expect(
      checkModule({ id: 'x', manifest: good.replace("['desktop']", '[]'), fileExists: f }),
    ).toHaveLength(1);
  });
});

describe('checkModule: seed contract', () => {
  const f = has('widgets/AWidget.tsx', 'seed.ts');

  it('requires the manifest field and seed.ts', () => {
    const noField = good.replace('  seed: { version: 1, dependsOn: [] },\n', '');
    expect(checkModule({ id: 'x', manifest: noField, fileExists: f }).join()).toContain('no `seed');
    expect(
      checkModule({ id: 'x', manifest: good, fileExists: has('widgets/AWidget.tsx') }).join(),
    ).toContain('seed.ts is missing');
  });

  it('accepts live-data modules without seed.ts but not with one', () => {
    const live = good.replace('dependsOn: []', "dependsOn: [], none: 'live-data'");
    expect(
      checkModule({ id: 'x', manifest: live, fileExists: has('widgets/AWidget.tsx') }),
    ).toEqual([]);
    expect(checkModule({ id: 'x', manifest: live, fileExists: f }).join()).toContain('exists');
  });

  it('wants a numeric version and dependsOn', () => {
    const bad = good.replace('{ version: 1, dependsOn: [] }', '{ }');
    expect(checkModule({ id: 'x', manifest: bad, fileExists: f })).toHaveLength(2);
  });
});

describe('checkModule: retired modules', () => {
  const retired = `const manifest = { id: 'x', retired: true, widgets: [], seed: { version: 1, dependsOn: [], none: 'retired' } };`;

  it('need no widget, layout or seed.ts', () => {
    expect(checkModule({ id: 'x', manifest: retired, fileExists: has() })).toEqual([]);
  });

  it('must say so in the seed and must not ship seed.ts or widgets', () => {
    const plain = retired.replace(", none: 'retired'", '');
    expect(checkModule({ id: 'x', manifest: plain, fileExists: has() }).join()).toContain('none');
    expect(
      checkModule({ id: 'x', manifest: retired, fileExists: has('seed.ts') }).join(),
    ).toContain('seed.ts');
  });
});

describe('checkWidgetSource', () => {
  it('wants an empty state or a link', () => {
    expect(checkWidgetSource('x', 'w', 'return <p>hi</p>')).toHaveLength(1);
    expect(checkWidgetSource('x', 'w', 'emptyAction={{}}')).toEqual([]);
    // the catalogue types bring their own empty state; the status card carries its action
    expect(checkWidgetSource('x', 'w', '<GaugeList empty="Leer" entries={[]} />')).toEqual([]);
    expect(checkWidgetSource('x', 'w', '<StatusCard icon="lock" state="x" />')).toEqual([]);
  });
});

describe('checkSettingsSource', () => {
  const categories = ['module', 'sicherheit'];
  it('accepts a known category and a missing one', () => {
    expect(
      checkSettingsSource('x', "export const settings = { category: 'sicherheit' }", categories),
    ).toEqual([]);
    expect(checkSettingsSource('x', 'export const settings = { fields: [] }', categories)).toEqual(
      [],
    );
  });
  it('rejects an unknown category', () => {
    expect(checkSettingsSource('x', "{ category: 'misc' }", categories)).toHaveLength(1);
  });
});
