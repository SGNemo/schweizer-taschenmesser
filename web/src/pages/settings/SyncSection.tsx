import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import {
  connect,
  disconnect,
  refreshServerStatus,
  resetServer,
  signOutThisDevice,
  syncNow,
  type ConnectFailure,
  type ConnectParams,
} from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { getPlatform } from '@/core/platform';
import { formatDateTime } from '@/core/time/dates';
import { isInsecureRemoteUrl } from '@/core/net/publicUrl';
import { t } from '@/strings';
import { tSettingsConnect } from '@/strings.settingsConnect';
import { Badge, Button, Card, Dialog, Switch, TextField } from '@/ui';
import { Actions, Facts, StateBanner, Step } from './ConnectParts';
import { SyncConflicts } from './SyncConflicts';
import { SyncDevices } from './SyncDevices';
import { FoldedGroup } from './FoldedGroup';
import { tLanSync } from '@/strings.lanSync';
import styles from './settings.module.css';

const formatTime = (at: number | undefined): string => (at ? formatDateTime(at) : t.sync.never);

/**
 * Desktop app only (the hub lives in the native shell): loaded on demand, so the QR generator and
 * the hub screens never weigh on the browser's and the phone's start.
 */
const LanHubSection = lazy(() =>
  import('./LanHubSection').then((m) => ({ default: m.LanHubSection })),
);
/** The phone's side (Android app): pairing with the hub PC by its QR. Loaded on demand as well. */
const LanClientSection = lazy(() =>
  import('./LanClientSection').then((m) => ({ default: m.LanClientSection })),
);

/** A first connect proposes end-to-end encryption; the switch stays an explicit opt-out. */
export const ENCRYPT_BY_DEFAULT = true;

export function SyncSection() {
  const status = useSyncStatus();
  const c = tSettingsConnect.use().sync;
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [encrypt, setEncrypt] = useState(ENCRYPT_BY_DEFAULT);
  const [passphrase, setPassphrase] = useState('');
  const [deviceName, setDeviceName] = useState(
    () => t.sync.deviceNames[getPlatform().kind] ?? t.sync.deviceNames.web!,
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ConnectFailure | undefined>();
  const [confirmReset, setConfirmReset] = useState(false);

  const l = tLanSync.use();
  // Desktop app: this PC can be the home-network hub; the own server moves into a folded group.
  const lanHub = getPlatform().lanHub.supported;
  const lanPhone = getPlatform().lanClient?.supported ?? false;
  const lan = lanHub || lanPhone;
  const viaLan = status.via === 'lanHub' || status.via === 'lanClient';
  const connected = status.phase !== 'off' && !viaLan;

  // The size on the server is read once per successful sync, not on every render.
  useEffect(() => {
    if (connected && status.lastSyncAt) void refreshServerStatus();
  }, [connected, status.lastSyncAt]);

  // When the sync server itself serves this app, its address is this origin: suggest it.
  useEffect(() => {
    // The installed app is not served by the sync server, so there is nothing to suggest.
    if (getPlatform().isNative) return;
    const controller = new AbortController();
    getPlatform()
      .fetch('/v1/health', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ ok?: boolean }>) : undefined))
      .then((body) => body?.ok && setUrl((current) => current || window.location.origin))
      .catch(() => undefined); // any other host answers with HTML or nothing: no suggestion
    return () => controller.abort();
  }, []);

  async function run(params: ConnectParams) {
    setBusy(true);
    setFailure(undefined);
    const result = await connect(params);
    setBusy(false);
    if (result.ok) {
      setToken('');
      setPassphrase('');
    } else setFailure(result.reason);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run({ url, token, encrypt, passphrase: passphrase || undefined, deviceName });
  };

  async function resetAndConnect() {
    setConfirmReset(false);
    setBusy(true);
    const problem = await resetServer({ url, token });
    setBusy(false);
    if (problem && !problem.ok) return setFailure(problem.reason);
    await run({ url, token, encrypt, passphrase: passphrase || undefined, deviceName });
  }

  const serverBody = (
    <div className={styles.form}>
      {connected || lan ? null : (
        <StateBanner icon="cloudOff" title={c.off} line={c.offLine} testId="sync-off" />
      )}
      <p className={styles.muted}>{t.sync.intro}</p>

      {connected ? (
        <>
          <StateBanner
            icon={status.phase === 'error' ? 'alert' : 'sync'}
            tone={status.phase === 'error' ? 'attention' : 'ok'}
            title={t.sync.state[status.phase]}
            line={t.sync.connected(status.server ?? '')}
            tinted={!lan}
            testId="sync-status"
          >
            <Badge tone={status.encrypted ? 'accent' : 'neutral'}>
              {status.encrypted ? t.sync.encryptedBadge : t.sync.plainBadge}
            </Badge>
          </StateBanner>
          <Facts
            label={c.facts}
            items={[
              { label: t.sync.lastSync, value: formatTime(status.lastSyncAt) },
              {
                label: c.factPending,
                value: t.sync.pending(status.pending),
                testId: 'sync-pending',
              },
              ...(status.lastResult
                ? [
                    {
                      label: t.sync.detailsTitle,
                      value: t.sync.lastResult(status.lastResult.applied, status.lastResult.pushed),
                      testId: 'sync-last-result',
                    },
                  ]
                : []),
              ...(status.serverStats
                ? [
                    {
                      label: t.sync.serverSize,
                      value: t.sync.serverSizeValue(
                        status.serverStats.records,
                        Math.max(1, Math.round(status.serverStats.bytes / 1024)),
                      ),
                      testId: 'sync-server-size',
                    },
                  ]
                : []),
            ]}
          />
          {status.rejected > 0 ? (
            <p role="alert" className={styles.error}>
              {t.sync.rejected(status.rejected)}
            </p>
          ) : null}
          {status.phase === 'error' ? (
            <p role="alert" className={styles.error}>
              {t.sync.errors[status.error ?? 'unknown']}
            </p>
          ) : null}
          {status.phase === 'error' && status.failures > 1 ? (
            <p className={styles.muted} data-testid="sync-failures">
              {t.sync.failuresInRow(status.failures)}
            </p>
          ) : null}
          <Actions>
            <Button
              variant="primary"
              onClick={() => void syncNow()}
              disabled={status.phase === 'syncing'}
            >
              {t.sync.syncNow}
            </Button>
          </Actions>
          <Step title={c.stepConnection}>
            <Actions>
              <Button onClick={() => void disconnect()}>{t.sync.disconnect}</Button>
              <Button variant="danger" onClick={() => void signOutThisDevice()}>
                {t.sync.signOut}
              </Button>
            </Actions>
            <p className={styles.muted}>{t.sync.disconnectHint}</p>
            <p className={styles.muted}>{t.sync.signOutHint}</p>
          </Step>
          <SyncDevices />
          <SyncConflicts />
        </>
      ) : (
        <form onSubmit={submit} className={styles.form}>
          <Step n={1} title={c.stepServer} hint={c.stepServerHint}>
            <TextField
              label={t.sync.serverUrl}
              hint={t.sync.serverUrlHint}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            {isInsecureRemoteUrl(url) ? (
              <p role="note" className={styles.error} data-testid="sync-http-warning">
                {t.sync.httpWarning}
              </p>
            ) : null}
            <TextField
              label={t.sync.token}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </Step>
          <Step n={2} title={c.stepDevice} hint={c.stepDeviceHint}>
            <TextField
              label={t.sync.deviceName}
              hint={t.sync.deviceNameHint}
              maxLength={64}
              autoComplete="off"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <Switch
              label={t.sync.encrypt}
              hint={t.sync.encryptHint}
              checked={encrypt}
              onChange={setEncrypt}
            />
            {!encrypt ? (
              <p className={styles.muted} data-testid="sync-plain-warning">
                {t.sync.plainWarning}
              </p>
            ) : null}
            <TextField
              label={t.sync.passphrase}
              hint={encrypt ? t.sync.passphraseHint : t.sync.passphraseJoinHint}
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </Step>
          {failure ? (
            <p role="alert" className={styles.error} data-testid="sync-failure">
              {t.sync.failures[failure]}
            </p>
          ) : null}
          <Actions>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? t.sync.connecting : t.sync.connect}
            </Button>
            {failure === 'server-has-plain-data' || failure === 'vault-outdated' ? (
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                {t.sync.resetServer}
              </Button>
            ) : null}
          </Actions>
        </form>
      )}
    </div>
  );

  return (
    <Card>
      {lan ? (
        <div className={styles.form}>
          <Suspense fallback={null}>
            {/* a PC paired with another hub PC shows the device side, like a phone */}
            {lanHub && status.via !== 'lanClient' ? <LanHubSection /> : <LanClientSection />}
          </Suspense>
          <FoldedGroup
            id="server"
            section="sync"
            title={l.ownServer}
            current={[connected ? (status.server ?? '') : l.ownServerOff]}
          >
            {viaLan ? (
              <p className={styles.muted} data-testid="sync-server-blocked">
                {status.via === 'lanClient' ? l.serverBlockedPhone : l.serverBlocked}
              </p>
            ) : (
              serverBody
            )}
          </FoldedGroup>
        </div>
      ) : (
        serverBody
      )}

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t.sync.resetTitle}
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>{t.actions.cancel}</Button>
            <Button variant="danger" onClick={() => void resetAndConnect()}>
              {t.sync.resetConfirm}
            </Button>
          </>
        }
      >
        <p>{t.sync.resetText}</p>
      </Dialog>
    </Card>
  );
}
