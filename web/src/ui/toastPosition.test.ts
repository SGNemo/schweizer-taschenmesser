import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_TOASTS } from '@/stores/ui';

/** Toasts are bottom centre everywhere (DESIGN-SPEC § 7): above the bottom bar on the phone, never over the reminder card. */
const css = readFileSync(new URL('./Misc.module.css', import.meta.url), 'utf8');
const block = (selector: string, from = 0) => {
  const at = css.indexOf(`${selector} {`, from);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

describe('toast position', () => {
  it('is fixed bottom centre', () => {
    const toasts = block('.toasts');
    expect(toasts).toContain('position: fixed');
    expect(toasts).toContain('left: 50%');
    expect(toasts).toContain('translateX(-50%)');
    expect(toasts).not.toMatch(/\btop:/);
  });

  it('sits above the bottom bar on the phone and on the page edge on desktop', () => {
    expect(block('.toasts')).toContain('var(--bottom-nav-h)');
    expect(
      block('.toasts', css.indexOf('@media (min-width: 900px)', css.indexOf('.toasts {'))),
    ).toContain('bottom: var(--space-5)');
  });

  it('stacks at most two, above the page layers', () => {
    expect(MAX_TOASTS).toBe(2);
    expect(block('.toasts')).toContain('z-index: var(--z-toast)');
  });
});
