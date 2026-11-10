import { Link } from 'react-router';
import { useRemoteHost, useRemoteHostWatch } from '@/core/remote/host';
import { settingsPath } from '@/core/settings/registry/paths';
import { tRemoteHost } from '@/strings.remoteHost';
import { Icon } from '@/ui';
import styles from './AppShell.module.css';

/**
 * Top bar, desktop: a quiet chip while a device controls this PC, and nothing at all otherwise.
 * Words and an icon, no colour of alarm, no motion; a click leads to the place where it can be
 * ended. The tray shows the same state from Rust when the window is closed.
 */
export function RemoteChip() {
  useRemoteHostWatch();
  const controller = useRemoteHost((s) => s.status?.controller ?? undefined);
  const l = tRemoteHost.use();
  if (!controller) return null;
  return (
    <Link
      to={settingsPath('verbindungen', 'remote')}
      className={styles.remoteChip}
      aria-label={l.chipLabel(controller.name)}
      title={l.chipLabel(controller.name)}
      data-testid="remote-chip"
    >
      <Icon name="monitor" size={18} />
      <span>{l.chip}</span>
    </Link>
  );
}
