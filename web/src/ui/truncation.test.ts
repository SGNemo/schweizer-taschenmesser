import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** One truncation rule (DESIGN-SPEC § 7a): text blocks end after --clamp-lines lines in an ellipsis, never overflow. */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const block = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

describe('text truncation', () => {
  const patterns = read('./Patterns.module.css');
  const widgets = read('./widgets/Widgets.module.css');

  it.each(['.title', '.muted', '.widgetItemTitle'])('%s is line-clamped', (sel) => {
    const css = block(patterns, sel);
    expect(css).toContain('-webkit-line-clamp: var(--clamp-lines)');
    expect(css).toContain('overflow: hidden');
    expect(css).not.toContain('overflow-wrap: anywhere');
  });

  it('tile labels may shrink and are clamped', () => {
    const css = block(widgets, '.tileLabel');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('-webkit-line-clamp: var(--clamp-lines)');
  });

  it('list rows no longer force a minimum text width', () => {
    expect(block(patterns, '.grid .main')).toContain('min-width: 0');
  });

  it('the clamp length is a token', () => {
    expect(read('./tokens.css')).toMatch(/--clamp-lines:\s*2;/);
  });
});
