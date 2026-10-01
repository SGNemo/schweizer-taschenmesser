import { describe, expect, it } from 'vitest';
import { checkModule, checkWidgetSource } from './checkModules';

const good = `
const manifest = {
  id: 'x',
  widgets: [
    { id: 'a', title: 'A', defaultSize: 's', sizes: ALL_WIDGET_SIZES, component: () => import('./widgets/AWidget') },
  ],
  layout: 'wide',
  platforms: ['desktop'],
};`;
const has =
  (...files: string[]) =>
  (rel: string) =>
    files.includes(rel);

describe('checkModule', () => {
  it('accepts a complete manifest', () => {
    expect(
      checkModule({ id: 'x', manifest: good, fileExists: has('widgets/AWidget.tsx') }),
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
      checkModule({ id: 'x', manifest: m, fileExists: has('widgets/AWidget.tsx') }).join(),
    ).toContain('`sizes`');
  });

  it('requires a layout (except dev-only modules) and valid platforms', () => {
    const f = has('widgets/AWidget.tsx');
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

describe('checkWidgetSource', () => {
  it('wants an empty state or a link', () => {
    expect(checkWidgetSource('x', 'w', 'return <p>hi</p>')).toHaveLength(1);
    expect(checkWidgetSource('x', 'w', 'emptyAction={{}}')).toEqual([]);
  });
});
