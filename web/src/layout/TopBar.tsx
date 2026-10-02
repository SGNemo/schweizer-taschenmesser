import { Link } from 'react-router';
import { isDevBuild } from '@/core/update/buildInfo';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Icon, Wordmark } from '@/ui';
import { FocusIndicator } from './FocusIndicator';
import { SyncBadge } from './SyncBadge';
import styles from './TopBar.module.css';

/** Search, the one "+ Neu", tools and sync; the logo only shows where there is no sidebar. */
export function TopBar() {
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const openTools = useUiStore((s) => s.openTools);
  return (
    <header className={styles.topbar}>
      <Link to="/" className={`${styles.brand} ${styles.phoneOnly}`} aria-label={t.nav.homeAria}>
        <Wordmark height={32} title={t.appName} />
      </Link>
      <button type="button" className={styles.searchBtn} onClick={() => setPaletteOpen(true)}>
        <Icon name="search" size={18} />
        <span>{t.actions.search}</span>
        <kbd className={`${styles.kbd} ${styles.desktopOnly}`}>{t.palette.hint}</kbd>
      </button>
      <FocusIndicator />
      {isDevBuild() ? (
        <span title={t.devPreview.badgeTitle} data-testid="dev-badge">
          <Badge tone="warning">{t.devPreview.badge}</Badge>
        </span>
      ) : null}
      <Button
        variant="primary"
        className={`${styles.create} ${styles.desktopOnly}`}
        aria-label={t.nav.createAria}
        onClick={() => setQuickAddOpen(true)}
      >
        <Icon name="plus" size={18} />
        {t.nav.create}
      </Button>
      <button
        type="button"
        className={styles.tools}
        aria-label={t.tools.open}
        title={t.tools.open}
        onClick={() => openTools()}
      >
        <Icon name="wrench" />
        <span className={styles.desktopOnly}>{t.nav.tools}</span>
      </button>
      <SyncBadge />
    </header>
  );
}
