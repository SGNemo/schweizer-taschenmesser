import { Link } from 'react-router';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './AppShell.module.css';

/** Shows sync activity in the top bar; only visible when sync is configured. */
export function SyncBadge() {
  const { phase, pending } = useSyncStatus();
  if (phase === 'off') return null;
  const label = t.sync.badge(t.sync.state[phase]);
  return (
    <Link
      to="/settings"
      className={`${styles.syncBadge} ${phase === 'error' ? styles.syncError : ''}`}
      aria-label={label}
      title={`${label}${pending ? ` · ${t.sync.pending(pending)}` : ''}`}
      data-testid="sync-badge"
      data-phase={phase}
    >
      <span className={phase === 'syncing' ? styles.spin : undefined}>
        <Icon name={phase === 'error' ? 'cloudOff' : 'sync'} size={20} />
      </span>
    </Link>
  );
}
