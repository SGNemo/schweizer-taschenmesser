import { useEffect, useRef, useState, type FocusEventHandler } from 'react';
import { isEditable, motionReduced, nextCollapsed } from '@/core/shell/topbarCollapse';
import { useUiStore } from '@/stores/ui';

/**
 * Folds the phone topbar away while scrolling down and brings it back on scrolling up, at the
 * top, with keyboard focus in the bar, and while a palette, dialog or the on-screen keyboard is
 * up. The page scrolls in the window on a phone and in `#main` on the desktop (where the bar
 * never folds): one capturing listener sees both. The decision itself: `core/shell/topbarCollapse.ts`.
 */
export function useTopbarCollapse(): {
  collapsed: boolean;
  focusProps: { onFocus: FocusEventHandler; onBlur: FocusEventHandler };
} {
  const [collapsed, setCollapsed] = useState(false);
  const state = useRef({ collapsed: false, prevY: 0, focusInside: false });
  const paletteOpen = useUiStore((s) => s.paletteOpen);

  useEffect(() => {
    const phone = matchMedia('(max-width: 899.98px)');
    const apply = (y: number) => {
      const s = state.current;
      const keyboardInset = parseFloat(
        document.documentElement.style.getPropertyValue('--kb-inset'),
      );
      const next = nextCollapsed({
        collapsed: s.collapsed,
        y,
        prevY: s.prevY,
        focusInside: s.focusInside,
        overlayOpen: paletteOpen || !!document.querySelector('dialog[open]'),
        keyboard: keyboardInset > 0 || isEditable(document.activeElement),
        phone: phone.matches,
        reducedMotion: motionReduced(),
      });
      s.prevY = y;
      if (next !== s.collapsed) {
        s.collapsed = next;
        setCollapsed(next);
      }
    };
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t === document) apply(document.scrollingElement?.scrollTop ?? window.scrollY);
      else if (t instanceof HTMLElement && t.id === 'main') apply(t.scrollTop);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    apply(document.scrollingElement?.scrollTop ?? 0);
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [paletteOpen]);

  const set = (focusInside: boolean) => {
    state.current.focusInside = focusInside;
    if (focusInside && state.current.collapsed) {
      state.current.collapsed = false;
      setCollapsed(false);
    }
  };
  return {
    collapsed,
    focusProps: {
      onFocus: () => set(true),
      onBlur: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) set(false);
      },
    },
  };
}
