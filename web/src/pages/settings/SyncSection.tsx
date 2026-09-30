import { useEffect, useState, type FormEvent } from 'react';
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
import { t } from '@/strings';
import { Badge, Button, Card, Dialog, Switch, TextField } from '@/ui';
import { SyncConflicts } from './SyncConflicts';
import { SyncDevices } from './SyncDevices';
import styles from './settings.module.css';

const formatTime = (at: number | undefined): string => (at ? formatDateTime(at) : t.sync.never);

export function SyncSection() {
  const status = useSyncStatus();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [deviceName, setDeviceName] = useState(
    () => t.sync.deviceNames[getPlatform().kind] ?? t.sync.deviceNames.web!,
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ConnectFailure | undefined>();
  const [confirmReset, setConfirmReset] = useState(false);

  const connected = status.phase !== 'off';

  // The size on the server is read once per successful sync, not on every render.
  useEffect(() => {
    if (connected && status.lastSyncAt) void refreshServerStatus();
  }, [connected, status.lastSyncAt]);

  // When the sync server itself serves this app, its address is this origin: suggest it.
  useEffect(() => {
    // The installed app is not served by the sync server, so there is nothing to suggest.
    if (getPlatform().isNative) return;
    const controller = new AbortController();
    fetch('/v1/health', { signal: controller.signal })
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

  return (
    <Card>
      <div className={styles.form}>
        <p>{t.sync.intro}</p>

        {connected ? (
          <>
            <dl className={styles.status} data-testid="sync-status">
              <dt>{t.sync.state[status.phase]}</dt>
              <dd>
                {t.sync.connected(status.server ?? '')}{' '}
                <Badge tone={status.encrypted ? 'accent' : 'neutral'}>
                  {status.encrypted ? t.sync.encryptedBadge : t.sync.plainBadge}
                </Badge>
              </dd>
              <dt>{t.sync.lastSync}</dt>
              <dd>{formatTime(status.lastSyncAt)}</dd>
              <dt>&nbsp;</dt>
              <dd data-testid="sync-pending">{t.sync.pending(status.pending)}</dd>
              {status.lastResult ? (
                <>
                  <dt>{t.sync.detailsTitle}</dt>
                  <dd data-testid="sync-last-result">
                    {t.sync.lastResult(status.lastResult.pulled, status.lastResult.pushed)}
                  </dd>
                </>
              ) : null}
              {status.serverStats ? (
                <>
                  <dt>{t.sync.serverSize}</dt>
                  <dd data-testid="sync-server-size">
                    {t.sync.serverSizeValue(
                      status.serverStats.records,
                      Math.max(1, Math.round(status.serverStats.bytes / 1024)),
                    )}
                  </dd>
                </>
              ) : null}
            </dl>
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
            <div className={styles.row}>
              <Button
                variant="primary"
                onClick={() => void syncNow()}
                disabled={status.phase === 'syncing'}
              >
                {t.sync.syncNow}
              </Button>
              <Button onClick={() => void disconnect()}>{t.sync.disconnect}</Button>
              <Button variant="danger" onClick={() => void signOutThisDevice()}>
                {t.sync.signOut}
              </Button>
            </div>
            <p className={styles.muted}>{t.sync.disconnectHint}</p>
            <p className={styles.muted}>{t.sync.signOutHint}</p>
            <SyncDevices />
            <SyncConflicts />
          </>
        ) : (
          <form onSubmit={submit} className={styles.form}>
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
            <TextField
              label={t.sync.token}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
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
            {failure ? (
              <p role="alert" className={styles.error} data-testid="sync-failure">
                {t.sync.failures[failure]}
              </p>
            ) : null}
            <div className={styles.row}>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? t.sync.connecting : t.sync.connect}
              </Button>
              {failure === 'server-has-plain-data' || failure === 'vault-outdated' ? (
                <Button variant="danger" onClick={() => setConfirmReset(true)}>
                  {t.sync.resetServer}
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </div>

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
