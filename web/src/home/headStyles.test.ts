import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The overview head (identity v3) is quiet by construction: its styles use tokens only, no motion of their own (so "reduce
 * motion" has nothing to switch off), no hex colours and no one-sided edges. "Ruhig" and "Modulfarben: Aus" work through the tokens.
 */
const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');
const FILES = ['OverviewHead.module.css', 'AttentionStrip.module.css', 'AgendaBlock.module.css'];

describe('overview head styles', () => {
  it.each(FILES)('%s: no hex colours, motion or edge stripes', (name) => {
    const css = read(name);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\btransition\b|\banimation\b|@keyframes/);
    expect(css).not.toMatch(/border-(left|right|inline-start|inline-end)\s*:/);
  });

  it('the widget frame takes its tint and pattern from the tokens that calm mode lowers', () => {
    const css = read('Home.module.css');
    expect(css).toMatch(/var\(--widget-tint\)/);
    expect(css).toMatch(/opacity:\s*var\(--pattern-widget\)/);
  });

  it('the dashed "Wartet noch" card is a full hairline, not a stripe', () => {
    expect(read('AttentionStrip.module.css')).toMatch(/\.waiting\s*\{[^}]*border:\s*1px dashed/s);
  });
});
