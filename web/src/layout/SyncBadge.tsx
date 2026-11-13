import { useState } from 'react';
import { Link } from 'react-router';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Icon } from '@/ui';
import styles from './AppShell.module.css';
import { settingsPath } from '@/core/settings/registry/paths';

/** Shows sync activity in the top bar; only visible when sync is configured. */
export function SyncBadge() {
  const { phase, pending, via, error, lastResult } = useSyncStatus();
  // No endless spin (DESIGN-SPEC § 9): the icon stands still while a sync runs. It pulses once when a round ends well
  // and changed something (records taken over or sent) or sync works again after an error; the quiet rounds every
  // minute and after each edit stay still (FOCUS checklist: no stimulus without news).
  const [seen, setSeen] = useState(phase);
  const [afterError, setAfterError] = useState(phase === 'error');
  const [pulses, setPulses] = useState(0);
  if (seen !== phase) {
    setSeen(phase);
    if (phase === 'error') setAfterError(true);
    if (seen === 'syncing' && phase === 'idle') {
      const changed = !!lastResult && lastResult.applied + lastResult.pushed > 0;
      if (changed || afterError) setPulses((n) => n + 1);
      setAfterError(false);
    }
  }
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
      <span
        key={pulses}
        className={pulses > 0 ? styles.pulse : styles.syncIcon}
        data-pulses={pulses}
      >
        <Icon name={alarm ? 'cloudOff' : 'sync'} size={20} />
      </span>
    </Link>
  );
}
