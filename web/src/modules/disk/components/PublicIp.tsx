import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './SystemTab.module.css';

/** What the lookup service answers; anything else counts as a failure. */
export function parsePublicIp(body: unknown): string | null {
  const ip = (body as { ip?: unknown } | null)?.ip;
  return typeof ip === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/**
 * The public address, only on a click and with a note naming the service. The answer is shown, not
 * stored; there is no automatic request anywhere in this module.
 */
export function PublicIp() {
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
    <div className={styles.section}>
      <h3>{t.system.publicIp}</h3>
      <p className={styles.muted}>{t.system.publicIpNote}</p>
      <div className={styles.row}>
        <Button variant="secondary" disabled={state.busy} onClick={() => void lookup()}>
          {t.system.publicIpButton}
        </Button>
        {state.ip ? (
          <span className={styles.mono} aria-live="polite" data-testid="public-ip">
            {state.ip}
          </span>
        ) : null}
        {state.failed ? <span role="alert">{t.system.publicIpFailed}</span> : null}
      </div>
    </div>
  );
}
