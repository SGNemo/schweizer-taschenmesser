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
  it('a card is as high as its content: no row quantum and no minimum height per size class (identity 4.0)', () => {
    const grid = rule('.grid');
    expect(grid).toContain('grid-auto-rows: auto');
    expect(grid).toContain('align-items: start');
    expect(grid).not.toContain('align-items: stretch');
    expect(css).not.toContain('--widget-unit');
    expect(css).not.toMatch(/\.(s|m|l)\s*\{[^}]*min-height/);
  });

  it('size classes are widths: m spans two columns, l the row (two columns from three on); the packed grid sets the rows', () => {
    const from = css.indexOf('@container page (min-width: 44rem)');
    expect(rule('.m', from)).toContain('grid-column: span 2');
    expect(rule('.l')).toContain('grid-column: 1 / -1');
    expect(rule('.l', css.indexOf('@container page (min-width: 70rem)'))).toContain(
      'grid-column: span 2',
    );
    expect(rule('.grid[data-packed] > .widget', from)).toContain('grid-row: span var(--rows, 2)');
  });
});
