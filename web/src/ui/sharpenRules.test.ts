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

  it('U28: the segmented switch sits on the 4-px grid', () => {
    const seg = block(patterns, '.segment');
    expect(seg).toContain('padding: var(--space-1)');
  });

  it('U43: the "Mehr Felder" ghost button lines up with the field edge', () => {
    expect(read('./AdvancedFields.tsx')).toContain('buttonStyles.flushStart');
  });
});
