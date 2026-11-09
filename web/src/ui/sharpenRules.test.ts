import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards of UI round 6 (docs/qa/round-6): small CSS rules of the shared building blocks that a later edit could quietly
 * undo. The pixel values are measured in the screenshots of the PR; these pin the rules behind them.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const block = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};
const patterns = read('./Patterns.module.css');

describe('UI round 6 rules', () => {
  it('U20: tiles of the grid layout align their content to the top, so titles of one band line up', () => {
    expect(block(patterns, '.grid .row')).toContain('align-items: flex-start');
  });

  it('U28: the segmented switch sits on the 4-px grid and keeps its 44 px touch target', () => {
    const seg = block(patterns, '.segment');
    expect(seg).toContain('padding: var(--space-1)');
    expect(seg).not.toMatch(/padding:\s*\dpx/);
    // Touch: 36 px button + 2 × 4 px track = 44 px, and the hit strip covers the track padding.
    expect(patterns).toContain('min-height: calc(var(--touch) - 2 * var(--space-1))');
    expect(patterns).toContain('inset: calc(-1 * var(--space-1)) 0');
  });

  it('U34: the last two header actions wrap as one group', () => {
    const group = block(patterns, '.headerGroup');
    expect(group).toContain('display: flex');
    expect(group).toContain('flex-wrap: nowrap');
  });

  it('U40: the action of a compact empty state (widgets) is a quiet link, not the orange accent', () => {
    const link = block(read('./Misc.module.css'), '.emptyCompact a');
    expect(link).toContain('color: var(--text-muted)');
    expect(link).toContain('text-decoration: underline');
    expect(link).toContain('white-space: nowrap');
    expect(link).not.toContain('--accent');
  });

  it('U43: the "Mehr Felder" ghost button lines up with the field edge', () => {
    expect(block(read('./Button.module.css'), '.flushStart')).toContain(
      'margin-inline-start: calc(-1 * var(--space-4))',
    );
    // Its padding is the one the margin takes back.
    expect(block(read('./Button.module.css'), '.btn')).toContain('padding: 0 var(--space-4)');
    expect(read('./AdvancedFields.tsx')).toContain('buttonStyles.flushStart');
  });

  it('U57: row titles hyphenate instead of breaking at any letter', () => {
    const widgets = read('./widgets/Widgets.module.css');
    for (const css of [block(patterns, '.title'), block(widgets, '.rowTitle')]) {
      expect(css).toContain('hyphens: auto');
      expect(css).toContain('overflow-wrap: break-word');
      expect(css).not.toContain('anywhere');
    }
    expect(block(patterns, '.titleFull')).not.toContain('anywhere');
    // Hyphenation needs the document language.
    expect(readFileSync(new URL('../../index.html', import.meta.url), 'utf8')).toMatch(
      /<html lang="de">/,
    );
  });
});
