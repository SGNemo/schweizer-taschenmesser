// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isKeepVisible, keyboardInset } from './keyboardInset';
import { menuSide } from './menuPlacement';

const base = { layoutHeight: 800, visualHeight: 800, visualOffsetTop: 0, scale: 1 };

describe('keyboardInset', () => {
  it('is 0 when the layout resized with the keyboard (visual = layout)', () => {
    expect(keyboardInset(base)).toBe(0);
  });
  it('is the covered height when only the visual viewport shrank', () => {
    expect(keyboardInset({ ...base, visualHeight: 500 })).toBe(300);
  });
  it('subtracts the offset the browser scrolled the visual viewport by', () => {
    expect(keyboardInset({ ...base, visualHeight: 500, visualOffsetTop: 100 })).toBe(200);
  });
  it('ignores a browser bar (small difference) and pinch zoom', () => {
    expect(keyboardInset({ ...base, visualHeight: 740 })).toBe(0);
    expect(keyboardInset({ ...base, visualHeight: 400, scale: 2 })).toBe(0);
  });
});

describe('isKeepVisible', () => {
  it('matches the marked add field and what is inside it', () => {
    document.body.innerHTML = '<form data-keep-visible><input id="a" /></form><input id="b" />';
    expect(isKeepVisible(document.getElementById('a'))).toBe(true);
    expect(isKeepVisible(document.getElementById('b'))).toBe(false);
    expect(isKeepVisible(null)).toBe(false);
  });
});

describe('menuSide', () => {
  const o = { menuHeight: 300, viewportHeight: 900, bottomReserve: 72 };
  it('opens down when it fits', () => {
    expect(menuSide({ ...o, triggerTop: 100, triggerBottom: 144 })).toBe('down');
  });
  it('opens up near the bottom bar when there is more room above', () => {
    expect(menuSide({ ...o, triggerTop: 700, triggerBottom: 744 })).toBe('up');
  });
  it('stays down when neither side fits and above is not larger', () => {
    expect(menuSide({ ...o, triggerTop: 60, triggerBottom: 104, viewportHeight: 300 })).toBe(
      'down',
    );
  });
});
