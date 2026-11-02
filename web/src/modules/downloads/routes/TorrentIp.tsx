import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './DownloadsPage.module.css';

/** What the lookup service answers; anything else counts as a failure. */
export function parsePublicIp(body: unknown): string | null {
  const ip = (body as { ip?: unknown } | null)?.ip;
  return typeof ip === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/** Your public address, only on a click (one request to the service named in the note); never stored. */
export function TorrentIp() {
  const [state, setState] = useState<{ ip?: string; failed?: boolean; busy?: boolean }>({});
  async function lookup() {
    setState({ busy: true });
    try {
      const res = await getPlatform().fetch('https://api.ipify.org?format=json');
      const ip = res.ok ? parsePublicIp(await res.json()) : null;
      setState(ip ? { ip } : { failed: true });
    } catch {
      setState({ failed: true });
    }
  }
  return (
    <div className={styles.ip}>
      <h3>{t.downloads.torrent.ip.title}</h3>
      <p className={styles.hint}>{t.downloads.torrent.ip.note}</p>
      <div className={styles.bar}>
        <Button disabled={state.busy} onClick={() => void lookup()}>
          {t.downloads.torrent.ip.button}
        </Button>
        {state.ip ? (
          <span className={styles.hash} aria-live="polite" data-testid="torrent-ip">
            {state.ip}
          </span>
        ) : null}
        {state.failed ? <span role="alert">{t.downloads.torrent.ip.failed}</span> : null}
      </div>
    </div>
  );
}
