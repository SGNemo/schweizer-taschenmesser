import { useEffect, useState } from 'react';
import { EXTENSION_ID } from '@nemo/vault-core';
import { getPlatform } from '@/core/platform';
import type { VaultBridgeRegistration } from '@/core/platform';
import { useBridgeConfig } from '@/core/vaultbridge/config';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Badge, Button, Dialog, Switch } from '@/ui';
import {
  bridgeRegistration,
  disableBridge,
  enableBridge,
  getBridge,
  needsReregistration,
  removeExtension,
} from '../bridge/control';
import { usePairingRequest } from '../bridge/pairing';
import styles from '../accounts.module.css';

const b = t.accounts.bridge;

/** Desktop only: switch the extension connection on, see its registration, manage confirmed extensions. */
export function BridgeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={b.title}>
      {open ? <Body /> : null}
    </Dialog>
  );
}

function Body() {
  const config = useBridgeConfig();
  const [registration, setRegistration] = useState<VaultBridgeRegistration | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = config?.enabled ?? false;

  useEffect(() => {
    if (enabled) void bridgeRegistration().then(setRegistration); // shown only while enabled
  }, [enabled]);

  async function toggle(on: boolean) {
    setBusy(true);
    setError('');
    try {
      if (on) {
        const result = await enableBridge();
        if (result !== 'ok') setError(b.errors[result]);
        else setRegistration(await bridgeRegistration());
      } else {
        await disableBridge();
      }
    } finally {
      setBusy(false);
    }
  }

  async function repair() {
    setBusy(true);
    try {
      setRegistration(await getPlatform().vaultBridge.register());
      useUiStore.getState().toast(b.reregistered);
    } catch {
      setError(b.errors['register-failed']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.grid}>
      <p className={styles.notice}>{b.intro}</p>
      <Switch
        label={b.enable}
        hint={b.enableHint}
        checked={enabled}
        disabled={busy || !config}
        onChange={(on) => void toggle(on)}
      />
      <p role="status" className={styles.notice}>
        {b.status}: {enabled ? b.statusOn : b.statusOff}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {enabled && registration ? (
        <>
          <p className={styles.notice}>
            {b.browsers}:{' '}
            {registration.browsers.map((r) => (
              <Badge key={r.browser}>
                {r.browser}: {r.registered ? b.registered : b.notRegistered}
              </Badge>
            ))}
          </p>
          {needsReregistration(registration) ? (
            <>
              <p role="alert">{b.stale}</p>
              <Button disabled={busy} onClick={() => void repair()}>
                {b.reregister}
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      <p className={styles.notice}>
        {b.extensionId}: <code>{EXTENSION_ID}</code>
      </p>
      <h3>{b.paired}</h3>
      {config && config.paired.length > 0 ? (
        <ul className={styles.historyList}>
          {config.paired.map((p) => (
            <li key={p.id} className={styles.inline}>
              <code>{p.id}</code>
              <Button variant="danger" onClick={() => void removeExtension(p.id)}>
                {b.disconnect}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.notice}>{b.pairedNone}</p>
      )}
    </div>
  );
}

/** Shown on the vault page while an extension waits for the user's confirmation. */
export function PairingDialog() {
  const pending = usePairingRequest((s) => s.pending);
  return (
    <Dialog
      open={pending !== null}
      onClose={() => getBridge().declinePairing()}
      title={b.pairingTitle}
    >
      {pending ? (
        <div className={styles.grid} data-testid="pairing">
          <p>{b.pairingText(pending.extensionId)}</p>
          <p>
            {b.pairingCode}: <code className={styles.code}>{pending.code}</code>
          </p>
          <div className={styles.inline}>
            <Button variant="primary" onClick={() => void getBridge().confirmPairing()}>
              {b.pairingConfirm}
            </Button>
            <Button onClick={() => getBridge().declinePairing()}>{b.pairingDecline}</Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
