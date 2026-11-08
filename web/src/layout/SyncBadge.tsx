import { Link } from 'react-router';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Icon } from '@/ui';
import styles from './AppShell.module.css';
import { settingsPath } from '@/core/settings/registry/paths';

/** Shows sync activity in the top bar; only visible when sync is configured. */
export function SyncBadge() {
  const { phase, pending, via, error } = useSyncStatus();
  if (phase === 'off') return null;
  // Home-network sync: a PC out of reach is the normal state away from home – calm, never red.
  const waiting =
    phase === 'error' && error === 'network' && (via === 'lanClient' || via === 'lanHub');
  const alarm = phase === 'error' && !waiting;
  const label = waiting ? tLanSync.get().badgeWaiting : t.sync.badge(t.sync.state[phase]);
  return (
    <Link
      to={settingsPath('sync', 'sync')}
      className={`${styles.syncBadge} ${alarm ? styles.syncError : ''}`}
      aria-label={label}
      title={`${label}${pending ? ` · ${t.sync.pending(pending)}` : ''}`}
      data-testid="sync-badge"
      data-phase={phase}
    >
      <span className={phase === 'syncing' ? styles.spin : undefined}>
        <Icon name={alarm ? 'cloudOff' : 'sync'} size={20} />
      </span>
    </Link>
  );
}
