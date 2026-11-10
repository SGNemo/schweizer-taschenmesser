import { useEffect, useState } from 'react';
import { page } from '@/core/net/OnlineChunk';
import { getPlatform } from '@/core/platform';
import { tLoading } from '@/strings.loading';
import { tOffline } from '@/strings.offline';
import { t } from '@/strings';
import { Button } from '@/ui';
import { hasDrafts } from '@/ui/useFormDraft';
import styles from './PageLoadingCard.module.css';

/** After this long the "…" of a loading module page gives way to the card. */
export const PAGE_SLOW_MS = 4_000;
/** After this long the wait is noted in the diagnostics log (module id only). */
export const PAGE_STUCK_MS = 15_000;

/** An import that never arrived: the browser's wording for a failed dynamic import, or Vite's preload error. */
export function isLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    error.message,
  );
}

/**
 * Same rule as `ChunkBoundary.retry` (core/net/OnlineChunk): the page remembers a failed or hanging import of
 * the same URL, so online only a reload loads it for sure. Offline nothing reloads (a browser without the
 * service worker would show its own error page); `inPlace` is what can still be tried there.
 */
export function retryPage(inPlace?: () => void): void {
  if (navigator.onLine) page.reload();
  else inPlace?.();
}

/**
 * Calm card in the page area: "Die Seite lädt noch · Neu laden". Shown by the module fallback once loading takes
 * long, and by the module error boundary when the page's code could not be loaded. A reload drops form drafts
 * (memory only, ui/useFormDraft), so the card says so, before the button, while there are any.
 *
 * Only the app in the browser can be waiting for the network: there, offline, the card says that it continues once
 * online and offers no button (a reload would end on the browser's own error page, and a page that failed to load
 * cannot be tried again in place). The desktop and Android apps carry their code with them, so they always get
 * "Neu laden". `live={false}` when the caller already is the live region (the fallback's `role="status"`).
 *
 * `failed`: the page's code did not arrive (the error boundary), so nothing is loading any more. Offline the card
 * then promises a reload once online instead of "it continues here", and when the connection comes back it says so
 * and points at the button instead of "still loading".
 */
export function PageLoadingCard({
  live = true,
  failed = false,
}: {
  live?: boolean;
  failed?: boolean;
}) {
  const texts = tLoading.use();
  const offline = tOffline.use();
  const networked = getPlatform().kind === 'web';
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cameBack, setCameBack] = useState(false);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      setCameBack(true);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const waitingForNetwork = networked && !online;
  const text = waitingForNetwork
    ? failed
      ? offline.page
      : offline.part
    : failed && networked && cameBack
      ? offline.pageBack
      : texts.still;
  return (
    <div className={styles.wrap}>
      <div
        className={styles.card}
        role={live ? 'status' : undefined}
        data-testid="page-loading-card"
      >
        <p className={styles.text}>{text}</p>
        {!waitingForNetwork && hasDrafts() ? <p className={styles.hint}>{texts.drafts}</p> : null}
        {!waitingForNetwork ? (
          <Button size="sm" onClick={() => page.reload()}>
            {t.actions.reload}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
