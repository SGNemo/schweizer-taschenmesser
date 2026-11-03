import { useEffect, useRef, useState } from 'react';
import { nextHeroCollapsed } from '@/core/shell/heroCollapse';

/** True while the phone page is scrolled far enough for the module head to shrink (decision: `core/shell/heroCollapse`). */
export function useHeroCollapse(): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const current = useRef(false);
  useEffect(() => {
    // No media queries (old WebView, tests): the head stays full.
    if (typeof matchMedia !== 'function') return;
    const phone = matchMedia('(max-width: 899.98px)');
    const apply = () => {
      const y = document.scrollingElement?.scrollTop ?? window.scrollY;
      const next = nextHeroCollapsed({ collapsed: current.current, y, phone: phone.matches });
      if (next !== current.current) {
        current.current = next;
        setCollapsed(next);
      }
    };
    document.addEventListener('scroll', apply, { capture: true, passive: true });
    apply();
    return () => document.removeEventListener('scroll', apply, { capture: true });
  }, []);
  return collapsed;
}
