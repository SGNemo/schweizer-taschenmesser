import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ModuleHue, PageLayout } from '@/core/modules/types';
import { createPageWidthStore, PageWidthContext } from '@/ui/pageWidth';
import styles from './PageContainer.module.css';
import { PageLoadingCard } from './PageLoadingCard';

/**
 * The one place that decides how wide a page may get. Pages do not set their own `max-width`;
 * they pick a variant (modules via `manifest.layout`). The container is a size container named
 * `page`, so module layouts react to the space they really get (`@container page (…)`), also
 * inside a narrow window or a future panel. Its width is also published (`ui/pageWidth`), so master–detail pages
 * (`useSplitView`) decide by the room the page has, not by the window.
 */
export function PageContainer({
  variant = 'content',
  hue,
  children,
}: {
  variant?: PageLayout;
  /** Module pages: the module's hue (`manifest.identity`), read by the header, charts and empty states via `--module-color`. */
  hue?: ModuleHue;
  children: ReactNode;
}) {
  const [store] = useState(createPageWidthStore);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) =>
      store.set(Math.round(entry?.contentRect.width ?? el.clientWidth)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);
  return (
    <PageWidthContext.Provider value={store}>
      <div
        ref={ref}
        className={`${styles.page} ${styles[variant]}`}
        data-hue={hue}
        data-testid="page"
      >
        {children}
      </div>
    </PageWidthContext.Provider>
  );
}

/**
 * Suspense fallback that fills the page area instead of a stray line of text. With `delay` (ms) the "…" gives
 * way to the calm card "Die Seite lädt noch · Neu laden" once loading takes that long (module pages).
 */
export function PageFallback({ delay }: { delay?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (delay === undefined) return;
    const timer = setTimeout(() => setSlow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  // One live region from the start: a region that is swapped for another one is usually not announced, a change
  // of its content is.
  return (
    <div role="status" className={styles.loading}>
      {slow ? <PageLoadingCard live={false} /> : '…'}
    </div>
  );
}
