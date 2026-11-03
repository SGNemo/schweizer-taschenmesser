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
