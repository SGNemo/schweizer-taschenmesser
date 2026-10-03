import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Pins the home grid's size classes (CSS Modules are not computed in jsdom, so the source is the contract). */
const css = readFileSync(new URL('./Home.module.css', import.meta.url), 'utf8');

function rule(selector: string, from = 0): string {
  const at = css.indexOf(`${selector} {`, from);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('home grid size classes', () => {
  it('rows snap to one unit and cards stretch to their cell', () => {
    const grid = rule('.grid');
    expect(grid).toContain('grid-auto-rows: minmax(var(--widget-unit), auto)');
    expect(grid).toContain('align-items: stretch');
    expect(grid).not.toContain('align-items: start');
  });

  it('size classes are fixed row spans from two columns on', () => {
    const wide = css.slice(css.indexOf('@container page (min-width: 44rem)'));
    expect(rule('.s', css.indexOf('@container page (min-width: 44rem)'))).toContain('span 2');
    expect(rule('.m', css.indexOf('@container page (min-width: 44rem)'))).toContain(
      'grid-row: span 3',
    );
    expect(rule('.l', css.indexOf('@container page (min-width: 44rem)'))).toContain(
      'grid-row: span 4',
    );
    expect(wide).toBeTruthy();
  });
});
