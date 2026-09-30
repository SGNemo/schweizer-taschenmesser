import { useLiveQuery } from 'dexie-react-hooks';
import { createElement, lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createContext } from '@/core/connectors/context';
import { connectors } from '@/core/connectors/registry';
import {
  connectOAuth,
  describeError,
  disconnect,
  hasClient,
  listCalendars,
  saveClient,
  selectCalendars,
  selectedCalendarIds,
  storedCalendars,
  syncCalendars,
} from '@/core/connectors/service';
import { saveStatus, useConnectorStatus } from '@/core/connectors/state';
import type { ConnectorContext, ConnectorDef, ExternalCalendar } from '@/core/connectors/types';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Card, Checkbox, Dialog, Icon, TextField } from '@/ui';
import styles from './settings.module.css';

const s = t.connectors;

/** Extra settings UIs of connectors, created once (React must not create components while rendering). */
const extras = new Map(
  connectors.filter((c) => c.settings).map((c) => [c.id, lazy(c.settings!)] as const),
);

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatDay(day, 'd. MMM yyyy')}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ClientForm({ def, onSaved }: { def: ConnectorDef; onSaved: () => void }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [known, setKnown] = useState<boolean | undefined>();
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    void hasClient(def.id).then((v) => alive && setKnown(v));
    return () => {
      alive = false;
    };
  }, [def.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!clientId.trim()) return setMessage(s.client.missing);
    await saveClient(def.id, { clientId, clientSecret });
    setClientId('');
    setClientSecret('');
    setKnown(true);
    setMessage(s.client.saved);
    onSaved();
  }

  return (
    <form onSubmit={(e) => void save(e)} className={styles.form} aria-label={s.client.title}>
      <p className={styles.muted}>{s.client.intro}</p>
      <TextField
        label={s.client.id}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder={known ? '••••••••' : ''}
        autoComplete="off"
        spellCheck={false}
      />
      <TextField
        label={s.client.secret}
        hint={s.client.secretHint}
        type="password"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        autoComplete="off"
      />
      <div className={styles.row}>
        <Button type="submit">{s.client.save}</Button>
        {message ? <span role="status">{message}</span> : null}
      </div>
    </form>
  );
}

/** The connector's own settings UI (loaded on demand); the component itself is static, see `extras`. */
function ExtraSettings({
  def,
  ctx,
  onChanged,
}: {
  def: ConnectorDef;
  ctx: ConnectorContext;
  onChanged: () => void;
}) {
  return (
    <Suspense fallback={null}>{createElement(extras.get(def.id)!, { ctx, onChanged })}</Suspense>
  );
}

function ConnectorCard({ def }: { def: ConnectorDef }) {
  const platform = getPlatform();
  const toast = useUiStore((st) => st.toast);
  const status = useConnectorStatus(def.id);
  const ctx = useMemo(() => createContext(def), [def]);
  const [features, setFeatures] = useState<string[] | undefined>();
  const [busy, setBusy] = useState<'connect' | 'sync' | undefined>();
  const calendars: ExternalCalendar[] = useLiveQuery(() => storedCalendars(def.id), [def.id]) ?? [];
  const selected: string[] = useLiveQuery(() => selectedCalendarIds(def.id), [def.id]) ?? [];
  const [confirm, setConfirm] = useState(false);
  const [clientVersion, setClientVersion] = useState(0);

  const canLogin =
    def.authType === 'oauth-pkce' &&
    def.platforms.includes(platform.kind) &&
    platform.oauth.supported;
  const state = status?.state ?? 'disconnected';
  const active = features ?? status?.features ?? def.features.map((f) => f.id);
  const connected = state === 'connected' || state === 'rate-limited' || state === 'error';

  async function login() {
    setBusy('connect');
    try {
      const next = await connectOAuth(def, active);
      if (next.state === 'connected' && def.calendar && active.includes('calendar')) {
        try {
          await listCalendars(def);
        } catch (e) {
          await saveStatus(def.id, { message: describeError(e) });
        }
      }
    } finally {
      setBusy(undefined);
    }
  }

  async function syncNow() {
    setBusy('sync');
    try {
      const r = await syncCalendars(def);
      toast(s.syncDone(r.added, r.updated, r.removed));
    } finally {
      setBusy(undefined);
    }
  }

  async function configurationChanged() {
    const configured = (await def.isConfigured?.(ctx)) ?? false;
    await saveStatus(
      def.id,
      configured
        ? { state: 'connected', message: undefined }
        : { state: 'disconnected', lastSyncAt: undefined },
    );
    if (configured) await syncNow();
    else await syncCalendars(def);
  }

  async function toggleCalendar(id: string, on: boolean) {
    const next = on ? [...selected, id] : selected.filter((c) => c !== id);
    await selectCalendars(def, next);
    if (on) await syncNow();
  }

  return (
    <Card title={def.name} data-testid={`connector-${def.id}`}>
      <div className={styles.form}>
        <div className={styles.row}>
          <Icon name={def.icon} />
          <span>{def.description}</span>
        </div>
        <dl className={styles.status}>
          <dt>{s.statusLabel}</dt>
          <dd>
            <Badge>{s.status[state] ?? state}</Badge>
          </dd>
          {status?.lastSyncAt ? (
            <>
              <dt>{s.calendars}</dt>
              <dd>{s.lastSync(formatWhen(status.lastSyncAt))}</dd>
            </>
          ) : null}
        </dl>
        {status?.message ? (
          <p className={styles.error} role="alert">
            {status.message}
          </p>
        ) : null}

        {def.authType === 'oauth-pkce' && !canLogin ? (
          <p className={styles.muted}>{def.unavailableHint ?? s.desktopOnly}</p>
        ) : null}

        {canLogin ? (
          <>
            <ClientForm
              key={clientVersion}
              def={def}
              onSaved={() => setClientVersion((v) => v + 1)}
            />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{s.features}</legend>
              {def.features.map((f) => (
                <Checkbox
                  key={f.id}
                  label={`${f.label} – ${f.description}`}
                  checked={active.includes(f.id)}
                  onChange={(e) =>
                    setFeatures(
                      e.target.checked ? [...active, f.id] : active.filter((x) => x !== f.id),
                    )
                  }
                />
              ))}
            </fieldset>
            <div className={styles.row}>
              <Button
                variant="primary"
                disabled={busy !== undefined || active.length === 0}
                onClick={() => void login()}
              >
                {busy === 'connect'
                  ? s.connecting
                  : state === 'expired' || connected
                    ? s.reconnect
                    : s.connect}
              </Button>
              {connected ? <Button onClick={() => setConfirm(true)}>{s.disconnect}</Button> : null}
            </div>
          </>
        ) : null}

        {extras.has(def.id) ? (
          <ExtraSettings def={def} ctx={ctx} onChanged={() => void configurationChanged()} />
        ) : null}

        {def.authType === 'oauth-pkce' && connected && def.calendar && calendars.length > 0 ? (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{s.calendars}</legend>
            <p className={styles.muted}>{s.calendarsHint}</p>
            {calendars.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={selected.includes(c.id)}
                onChange={(e) => void toggleCalendar(c.id, e.target.checked)}
              />
            ))}
          </fieldset>
        ) : null}

        {connected && def.calendar ? (
          <div className={styles.row}>
            <Button disabled={busy !== undefined} onClick={() => void syncNow()}>
              {busy === 'sync' ? s.syncing : s.syncNow}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={s.disconnectTitle(def.name)}
        footer={<Button onClick={() => setConfirm(false)}>{t.actions.cancel}</Button>}
      >
        <div className={styles.form}>
          <p>{s.disconnectBody}</p>
          <div className={styles.row}>
            <Button
              onClick={() => {
                void disconnect(def, { keepData: true }).then(() => setConfirm(false));
              }}
            >
              {s.keepData}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void disconnect(def, { keepData: false }).then(() => setConfirm(false));
              }}
            >
              {s.deleteData}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

/** Settings → Verbindungen: one card per connector (`src/connectors/*`). */
export function ConnectorsSection() {
  return (
    <div className={styles.form}>
      <p className={styles.muted}>{s.intro}</p>
      {connectors.map((def) => (
        <ConnectorCard key={def.id} def={def} />
      ))}
    </div>
  );
}
