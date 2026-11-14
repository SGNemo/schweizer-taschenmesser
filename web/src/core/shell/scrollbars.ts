/**
 * Scrollbars show while an area scrolls (identity v3, docs/design/identity-v3/02-CONCEPT.md § 6): the element that
 * scrolls gets `data-scrolling="true"` for a moment, and `ui/global.css` turns its thumb on while the attribute is
 * there (and while the pointer is over it). Passive and capturing, so no scroller needs to know about it.
 */
export const SCROLLING_MS = 700;

export function watchScrolling(root: Document = document): () => void {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const onScroll = (e: Event) => {
    const target = e.target instanceof Element ? e.target : root.documentElement;
    target.setAttribute('data-scrolling', 'true');
    const running = timers.get(target);
    if (running) clearTimeout(running);
    timers.set(
      target,
      setTimeout(() => {
        target.removeAttribute('data-scrolling');
        timers.delete(target);
      }, SCROLLING_MS),
    );
  };
  root.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => {
    root.removeEventListener('scroll', onScroll, { capture: true });
    for (const [el, timer] of timers) {
      clearTimeout(timer);
      el.removeAttribute('data-scrolling');
    }
    timers.clear();
  };
}

/**
 * The width a classic scrollbar takes (Windows; 0 for overlay scrollbars on macOS, Android, iOS), as
 * `--scrollbar-w` on the root. The desktop content area keeps that gutter (`scrollbar-gutter: stable`) and takes it
 * off its right padding (`layout/AppShell.module.css`), so the page's right edge stays flush with the top bar's
 * whether a page scrolls or not (0b-R). Measured with the app's own scrollbar style (`scrollbar-width: thin`) and
 * again on resize, because a browser zoom changes the width in CSS pixels.
 */
export function measureScrollbarWidth(root: Document = document): number {
  const probe = root.createElement('div');
  // The gutter `.main` keeps (`scrollbar-gutter: stable`), measured the same way, so the two always agree.
  probe.style.cssText =
    'position:absolute;top:-9999px;width:100px;height:100px;overflow:hidden;scrollbar-gutter:stable;visibility:hidden';
  root.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return Math.max(0, width);
}

export function watchScrollbarWidth(root: Document = document): () => void {
  const view = root.defaultView;
  const apply = () =>
    root.documentElement.style.setProperty('--scrollbar-w', `${measureScrollbarWidth(root)}px`);
  apply();
  view?.addEventListener('resize', apply, { passive: true });
  return () => {
    view?.removeEventListener('resize', apply);
    root.documentElement.style.removeProperty('--scrollbar-w');
  };
}
