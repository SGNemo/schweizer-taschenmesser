import { Component, lazy, useState, type ComponentType, type ReactNode } from 'react';
import { t } from '@/strings';
import { tOffline } from '@/strings.offline';
import { Button, Icon } from '@/ui';
import styles from './OnlineChunk.module.css';

/**
 * Code that is not in the service worker's precache (tools, chat; docs/perf/COLD-START-2026-10.md) loads
 * from the network on first use and is kept by the runtime cache afterwards. Opened offline before it was
 * ever loaded, the import fails: instead of an error screen, one calm line says it continues once online,
 * and it retries by itself when the device is back online (or on "Erneut versuchen").
 *
 * Chromium remembers a failed dynamic import for the life of the page (a second `import()` of the same URL
 * fails at once, even online). So coming back online first retries in place (enough where the browser does
 * not remember); "Erneut versuchen" while online reloads the page right away (also for a stale page after
 * a deploy), offline it retries in place. Nothing reloads by itself.
 */

/** Seam for tests (jsdom cannot reload). */
export const page = { reload: (): void => window.location.reload() };

/** The import of a lazily loaded part failed (offline, server gone); render errors stay what they are. */
export class ChunkUnavailable extends Error {
  constructor(cause: unknown) {
    super('chunk unavailable', { cause });
    this.name = 'ChunkUnavailable';
  }
}

export function OfflineNotice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className={styles.notice} role="status" data-testid="online-chunk">
      <Icon name="cloudOff" size={20} />
      <p className={styles.text}>{text}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          {t.ui.retry}
        </Button>
      ) : null}
    </div>
  );
}

interface BoundaryProps {
  onRetry: () => void;
  children: ReactNode;
}

class ChunkBoundary extends Component<BoundaryProps, { error: unknown }> {
  override state: { error: unknown } = { error: undefined };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  retry = (fromOnlineEvent = false) => {
    // A click while online: this page may remember the failure, only a reload loads it for sure.
    if (!fromOnlineEvent && navigator.onLine) return page.reload();
    this.props.onRetry();
    this.setState({ error: undefined });
  };
  override componentDidMount() {
    window.addEventListener('online', this.onOnline);
  }
  override componentWillUnmount() {
    window.removeEventListener('online', this.onOnline);
  }
  onOnline = () => {
    if (this.state.error instanceof ChunkUnavailable) this.retry(true);
  };
  override render() {
    const { error } = this.state;
    if (error instanceof ChunkUnavailable)
      return <OfflineNotice text={tOffline.get().part} onRetry={() => this.retry()} />;
    // Anything else goes on to the next boundary, exactly as before.
    if (error !== undefined) throw error;
    return this.props.children;
  }
}

/**
 * `React.lazy` for a part that may be missing offline: a failed import shows the calm notice and is
 * tried again (a fresh `lazy`, React caches the failed one) instead of reaching an error screen.
 * Loading itself suspends to the caller's `Suspense` (tools sheet, router), so the waiting state stays
 * the one the place already shows.
 */
export function lazyOnline<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  const make = () =>
    lazy<ComponentType<P>>(() =>
      load().catch((e: unknown): never => {
        throw new ChunkUnavailable(e);
      }),
    );
  let Lazy = make();
  function OnlineChunk(props: P) {
    const [, setTry] = useState(0);
    return (
      <ChunkBoundary
        onRetry={() => {
          Lazy = make();
          setTry((n) => n + 1);
        }}
      >
        <Lazy {...props} />
      </ChunkBoundary>
    );
  }
  return OnlineChunk;
}
