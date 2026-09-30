import { useEffect, useState, type FormEvent } from 'react';
import {
  connect,
  disconnect,
  resetServer,
  syncNow,
  type ConnectFailure,
  type ConnectParams,
} from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge, Button, Card, Dialog, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

function formatTime(at: number | undefined): string {
  if (!at) return t.sync.never;
  const d = new Date(at);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${formatDay(d.toISOString().slice(0, 10), 'd. MMM')} ${time}`;
}

export function SyncSection() {
  const status = useSyncStatus();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ConnectFailure | undefined>();
  const [confirmReset, setConfirmReset] = useState(false);

  const connected = status.phase !== 'off';

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
    void run({ url, token, encrypt, passphrase: passphrase || undefined });
  };

  async function resetAndConnect() {
    setConfirmReset(false);
    setBusy(true);
    const problem = await resetServer({ url, token });
    setBusy(false);
    if (problem && !problem.ok) return setFailure(problem.reason);
    await run({ url, token, encrypt, passphrase: passphrase || undefined });
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
            </dl>
            {status.phase === 'error' ? (
              <p role="alert" className={styles.error}>
                {t.sync.errors[status.error ?? 'unknown']}
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
            </div>
            <p className={styles.muted}>{t.sync.disconnectHint}</p>
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
            <Switch
              label={t.sync.encrypt}
              hint={t.sync.encryptHint}
              checked={encrypt}
              onChange={setEncrypt}
            />
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
              {failure === 'server-has-plain-data' ? (
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
