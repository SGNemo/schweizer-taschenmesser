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
  it('rows of equal height: every card reaches the tallest card of its row; no row quantum, no minimum height per size class', () => {
    const grid = rule('.grid');
    expect(grid).toContain('grid-auto-rows: auto');
    expect(grid).toContain('align-items: stretch');
    expect(grid).not.toContain('align-items: start');
    // The card fills its cell, so the row is flush at the bottom too.
    expect(rule('.widget > section')).toContain('flex: 1');
    // No masonry spans any more (they made rows ragged).
    expect(css).not.toContain('--rows');
    expect(css).not.toContain('data-packed');
    expect(css).not.toContain('--widget-unit');
    expect(css).not.toMatch(/\.(s|m|l)\s*\{[^}]*min-height/);
  });

  it('the widget head ends flush: the hidden gear takes no room, it shows in the place of the mark', () => {
    const hover = css.indexOf('@media (hover: hover)', css.indexOf('.gear {'));
    expect(rule('.gear', hover)).toContain('position: absolute');
    expect(rule('.gear', hover)).toContain('opacity: 0');
    expect(css).toContain('.widget:hover .head:has(.gear) .mark');
  });

  it('an empty widget shows no fish, only its line and next step', () => {
    expect(rule('.widget [data-empty-mark]')).toContain('display: none');
  });

  it('size classes are widths: m spans two columns, l the row (two columns from three on)', () => {
    const from = css.indexOf('@container page (min-width: 44rem)');
    expect(rule('.m', from)).toContain('grid-column: span 2');
    expect(rule('.l')).toContain('grid-column: 1 / -1');
    expect(rule('.l', css.indexOf('@container page (min-width: 70rem)'))).toContain(
      'grid-column: span 2',
    );
  });
});
