/**
 * The on-screen keyboard on phones, read from `visualViewport` (the page itself already asks the
 * browser to resize with it: `interactive-widget=resizes-content` in index.html). Where a browser
 * ignores that and only shrinks the visual viewport, `--kb-inset` carries the covered height so
 * bottom sheets lift above the keyboard, and a focused add field (`data-keep-visible`) is scrolled
 * into view. With a resizing browser the inset is 0 and nothing changes.
 */

/** Below this the "keyboard" is a browser bar or rounding, not a keyboard. */
const MIN_KEYBOARD_PX = 120;

export interface ViewportSizes {
  /** `window.innerHeight`: the layout viewport. */
  layoutHeight: number;
  /** `visualViewport.height`, `.offsetTop`, `.scale`. */
  visualHeight: number;
  visualOffsetTop: number;
  scale: number;
}

/** Height in px that the keyboard covers at the bottom of the layout viewport (0 = none). */
export function keyboardInset(v: ViewportSizes): number {
  // Pinch zoom also shrinks the visual viewport; that is not a keyboard.
  if (Math.abs(v.scale - 1) > 0.01) return 0;
  const covered = Math.round(v.layoutHeight - v.visualHeight - v.visualOffsetTop);
  return covered >= MIN_KEYBOARD_PX ? covered : 0;
}

/** Whether the focused element is an add field that must stay above the keyboard. */
export function isKeepVisible(el: Element | null): boolean {
  return !!el && !!el.closest('[data-keep-visible]');
}

/** Starts listening; returns the cleanup. A no-op without `visualViewport`. */
export function watchKeyboard(): () => void {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return () => undefined;
  const root = document.documentElement;
  const update = () => {
    const inset = keyboardInset({
      layoutHeight: window.innerHeight,
      visualHeight: vv.height,
      visualOffsetTop: vv.offsetTop,
      scale: vv.scale,
    });
    root.style.setProperty('--kb-inset', `${inset}px`);
    const active = document.activeElement;
    // 'nearest' + instant: nothing jumps when the field is already visible.
    if (inset > 0 && isKeepVisible(active)) active?.scrollIntoView({ block: 'nearest' });
  };
  update();
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    root.style.removeProperty('--kb-inset');
  };
}
