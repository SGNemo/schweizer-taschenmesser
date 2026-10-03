import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Root size on big monitors (DESIGN-SPEC § 2): 16 px up to 1920 px wide, 20 px from 3440 px wide. */
describe('fluid root size', () => {
  const m =
    /:root\s*{\s*font-size:\s*clamp\(1rem, 1rem \+ \(100vw - 1920px\) \* ([\d.]+), 1\.25rem\);/.exec(
      css,
    );
  const px = (vw: number) => Math.min(20, Math.max(16, 16 + (vw - 1920) * Number(m?.[1])));

  it('is declared', () => expect(m).not.toBeNull());
  it('stays 16 px up to full HD', () => {
    expect(px(1280)).toBe(16);
    expect(px(1920)).toBe(16);
  });
  it('grows on 1440p and ultrawide, capped at 20 px', () => {
    expect(px(2560)).toBeGreaterThan(17);
    expect(px(2560)).toBeLessThan(18);
    expect(px(3440)).toBeCloseTo(20, 0);
    expect(px(7680)).toBe(20);
  });
  it('the text-size choice still wins over the fluid root', () => {
    expect(css.indexOf("data-text-size='large'")).toBeGreaterThan(css.indexOf('100vw - 1920px'));
  });
  it('sidebar and rail scale with the root', () => {
    expect(css).toMatch(/--sidebar-w:\s*15\.5rem/);
  });
});
