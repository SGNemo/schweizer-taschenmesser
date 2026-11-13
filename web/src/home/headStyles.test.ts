import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The overview head (identity 4.0) is quiet by construction: its styles use tokens only, no motion of their own (so "reduce
 * motion" has nothing to switch off), no hex colours and no one-sided edges. It lies on tone steps: no shadow, no tinted widget head.
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

  it('the widget frame is a tone step: no tinted head, no pattern and no wash behind the text (identity 4.0)', () => {
    const css = read('Home.module.css');
    expect(css).not.toMatch(/var\(--widget-tint\)|var\(--pattern-widget\)|var\(--area-pattern/);
    expect(css).not.toMatch(/linear-gradient/);
    // Height by content: no minimum height per size class.
    expect(css).not.toMatch(/min-height:\s*calc\(/);
  });

  it('shadows only for what floats: the strip, the day cards and the widgets have none (the dragged card does)', () => {
    for (const name of FILES) expect(read(name)).not.toMatch(/var\(--shadow-/);
    const shadows = read('Home.module.css').match(/var\(--shadow-[12]\)/g) ?? [];
    expect(shadows).toEqual(['var(--shadow-2)']);
  });

  it('"Kann warten" is a quiet tone step, not a dashed frame', () => {
    const css = read('AttentionStrip.module.css');
    expect(css).not.toMatch(/dashed/);
    expect(css).toMatch(/\.fold\s*\{[^}]*background:\s*var\(--surface-raised\)/s);
  });
});
