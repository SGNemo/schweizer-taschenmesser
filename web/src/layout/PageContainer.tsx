import type { ReactNode } from 'react';
import type { PageLayout } from '@/core/modules/types';
import styles from './PageContainer.module.css';

/**
 * The one place that decides how wide a page may get. Pages do not set their own `max-width`;
 * they pick a variant (modules via `manifest.layout`). The container is a size container named
 * `page`, so module layouts react to the space they really get (`@container page (…)`), also
 * inside a narrow window or a future panel.
 */
export function PageContainer({
  variant = 'content',
  children,
}: {
  variant?: PageLayout;
  children: ReactNode;
}) {
  return <div className={`${styles.page} ${styles[variant]}`}>{children}</div>;
}

/** Suspense fallback that fills the page area instead of a stray line of text. */
export function PageFallback() {
  return (
    <p role="status" className={styles.loading}>
      …
    </p>
  );
}
