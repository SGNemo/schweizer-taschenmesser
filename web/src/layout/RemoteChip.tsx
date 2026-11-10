import { Link } from 'react-router';
import { useRemoteHost, useRemoteHostWatch } from '@/core/remote/host';
import { settingsPath } from '@/core/settings/registry/paths';
import { tRemoteHost } from '@/strings.remoteHost';
import { Icon } from '@/ui';
import styles from './AppShell.module.css';

/**
 * Top bar, desktop: a quiet chip while a device controls this PC, and nothing at all otherwise.
 * It names the device (so a second person at the PC sees who it is); in a narrow window only the
 * icon stays. Words and an icon, no colour of alarm, no motion; a click leads to the place where it can be
 * ended. The tray shows the same state from Rust when the window is closed.
 */
export function RemoteChip() {
  useRemoteHostWatch();
  // the name alone: a reading that changes nothing re-renders nothing
  const claimed = useRemoteHost((s) => s.status?.controller?.name);
  const id = useRemoteHost((s) => s.status?.controller?.id);
  const l = tRemoteHost.use();
  if (claimed === undefined || id === undefined) return null;
  const name = claimed || l.unnamed(id.slice(0, 4));
  return (
    <Link
      to={settingsPath('verbindungen', 'remote')}
      className={styles.remoteChip}
      aria-label={l.chipLabel(name)}
      title={l.chipLabel(name)}
      data-testid="remote-chip"
    >
      <Icon name="monitor" size={18} />
      <span className={styles.remoteChipText}>{l.chip(name)}</span>
    </Link>
  );
}
