import { useState } from 'react';
import { useApiBatches } from '@/core/dataapi/pending';
import { apiModules } from '@/core/dataapi/scope';
import { batchStatus, countRecords, undoImport } from '@/core/importer/batches';
import {
  createToken,
  DEFAULT_PORT,
  isExpired,
  MAX_PORT,
  MIN_PORT,
  revokeToken,
  updateConfig,
  useLocalApiConfig,
  type ApiToken,
  type Grant,
} from '@/core/localapi/config';
import { clearLog, lastUsed, useAccessLog } from '@/core/localapi/log';
import { buildApiPrompt } from '@/core/localapi/prompt';
import { useLocalApiStatus } from '@/core/localapi/service';
import { useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { availableManifests } from '@/core/modules/available';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Card, Checkbox, Dialog, SelectField, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

const EXPIRY_CHOICES = ['30', '90', '365', 'never'];
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

type Draft = { name: string; expiry: string; grants: Record<string, Grant>; autoCommit: boolean };
const emptyDraft = (): Draft => ({ name: '', expiry: '90', grants: {}, autoCommit: false });

/** Settings → "KI-Zugriff": switch, port, access tokens with rights, recent requests. */
export function LocalApiSection() {
  const status = useLocalApiStatus();
  const config = useLocalApiConfig();
  const log = useAccessLog();
  const batches = useApiBatches();
  const states = useModuleStates();
  const toast = useUiStore((s) => s.toast);
  const [port, setPort] = useState<string | undefined>();
  const [portError, setPortError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: 'revoke' | 'renew'; token: ApiToken } | null>(
    null,
  );

  if (status.state === 'unsupported') {
    return (
      <Card>
        <p className={styles.muted}>{t.localApi.unsupported}</p>
      </Card>
    );
  }
  if (!config) return null;

  const modules = states ? apiModules(availableManifests(), states) : [];
  const used = lastUsed(log ?? []);
  const statusText = () => {
    if (status.state === 'error') return t.localApi.startErrors[status.error ?? 'listen-failed'];
    const entry = t.localApi.status[status.state];
    return typeof entry === 'function' ? entry(status.port ?? config.port) : entry;
  };

  async function applyPort() {
    const n = Number(port);
    if (!Number.isInteger(n) || n < MIN_PORT || n > MAX_PORT) {
      setPortError(t.localApi.portInvalid);
      return;
    }
    setPortError('');
    await updateConfig({ port: n });
    setPort(undefined);
  }

  async function submitDraft() {
    if (!draft) return;
    if (!draft.name.trim()) return setDraftError(t.localApi.nameMissing);
    if (!Object.values(draft.grants).some((g) => g.read || g.write))
      return setDraftError(t.localApi.rightsMissing);
    const { token } = await createToken({
      name: draft.name,
      grants: draft.grants,
      expiresInDays: draft.expiry === 'never' ? null : Number(draft.expiry),
      autoCommit: draft.autoCommit,
    });
    setDraft(null);
    setShown(token);
  }

  async function confirmPending() {
    if (!pending) return;
    const { kind, token } = pending;
    setPending(null);
    await revokeToken(token.id);
    if (kind === 'revoke') {
      toast(t.localApi.revoked);
      return;
    }
    const days =
      token.expiresAt === null
        ? null
        : Math.max(1, Math.round((token.expiresAt - token.createdAt) / 86_400_000));
    const created = await createToken({
      name: token.name,
      grants: token.grants,
      expiresInDays: days,
      autoCommit: token.autoCommit,
    });
    setShown(created.token);
  }

  const setGrant = (moduleId: string, key: keyof Grant, value: boolean) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            grants: {
              ...d.grants,
              [moduleId]: { read: false, write: false, ...d.grants[moduleId], [key]: value },
            },
          }
        : d,
    );

  return (
    <Card>
      <div className={styles.form}>
        <p>{t.localApi.intro}</p>
        <Switch
          label={t.localApi.enable}
          hint={t.localApi.enableHint}
          checked={config.enabled}
          onChange={(enabled) => void updateConfig({ enabled })}
        />
        <p>
          {t.localApi.statusLabel}:{' '}
          <span role="status" className={status.state === 'error' ? styles.error : undefined}>
            {statusText()}
          </span>
        </p>
        <div className={styles.row}>
          <TextField
            label={t.localApi.port}
            hint={t.localApi.portHint}
            inputMode="numeric"
            value={port ?? String(config.port)}
            placeholder={String(DEFAULT_PORT)}
            onChange={(e) => setPort(e.target.value)}
          />
          {port !== undefined ? (
            <Button onClick={() => void applyPort()}>{t.localApi.applyPort}</Button>
          ) : null}
        </div>
        {portError ? (
          <p className={styles.error} role="alert">
            {portError}
          </p>
        ) : null}

        <div className={styles.row}>
          <Button
            onClick={() =>
              void getPlatform()
                .clipboard.writeText(buildApiPrompt(config.port))
                .then(
                  () => toast(t.localApi.promptCopied),
                  () => toast(t.dataApi.copyFailed),
                )
            }
          >
            {t.localApi.copyPrompt}
          </Button>
          <span className={styles.muted}>{t.localApi.copyPromptHint}</span>
        </div>

        <h3>{t.localApi.tokens}</h3>
        {config.tokens.length === 0 ? <p className={styles.muted}>{t.localApi.noTokens}</p> : null}
        <ul className={styles.providerList} aria-label={t.localApi.tokens}>
          {config.tokens.map((token) => {
            const expired = isExpired(token);
            const last = used.get(token.id);
            return (
              <li key={token.id} className={styles.provider}>
                <div className={styles.providerHead}>
                  <span className={styles.providerTitle}>
                    {token.name}
                    {expired ? <Badge>{t.localApi.expired}</Badge> : null}
                    {token.autoCommit ? <Badge tone="accent">{t.localApi.autoCommit}</Badge> : null}
                  </span>
                  <span className={styles.row}>
                    <Button onClick={() => setPending({ kind: 'renew', token })}>
                      {t.localApi.renew}
                    </Button>
                    <Button variant="danger" onClick={() => setPending({ kind: 'revoke', token })}>
                      {t.localApi.revoke}
                    </Button>
                  </span>
                </div>
                <span className={styles.muted}>
                  {Object.entries(token.grants)
                    .map(
                      ([id, g]) =>
                        `${getManifest(id)?.name ?? id}: ${t.localApi.rightsSummary(g.read, g.write)}`,
                    )
                    .join(' · ')}
                </span>
                <span className={styles.muted}>
                  {[
                    t.localApi.created(date.format(token.createdAt)),
                    token.expiresAt === null
                      ? t.localApi.never
                      : t.localApi.expires(date.format(token.expiresAt)),
                    last === undefined
                      ? t.localApi.unused
                      : t.localApi.lastUsed(dateTime.format(last)),
                  ].join(' · ')}
                </span>
              </li>
            );
          })}
        </ul>
        <div className={styles.row}>
          <Button
            variant="primary"
            onClick={() => {
              setDraftError('');
              setDraft(emptyDraft());
            }}
          >
            {t.localApi.newToken}
          </Button>
        </div>

        <h3>{t.localApi.imports}</h3>
        {(batches ?? []).length === 0 ? (
          <p className={styles.muted}>{t.localApi.noImports}</p>
        ) : (
          <ul className={styles.providerList} aria-label={t.localApi.imports}>
            {(batches ?? []).slice(0, 10).map((b) => {
              const state = batchStatus(b);
              const manifest = getManifest(b.moduleId);
              return (
                <li key={b.id} className={styles.row}>
                  <span className={styles.muted}>
                    {dateTime.format(b.createdAt)} · {manifest?.name ?? b.moduleId} · {b.tokenName}{' '}
                    ·{' '}
                    {state === 'committed'
                      ? t.localApi.importState.committed(countRecords(b))
                      : t.localApi.importState[state]}
                  </span>
                  {state === 'committed' && manifest ? (
                    <Button
                      onClick={() =>
                        void undoImport(manifest, b.id).then(({ removed, kept }) =>
                          toast(t.onboarding.undone(removed, kept)),
                        )
                      }
                    >
                      {t.onboarding.undo}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <h3>{t.localApi.log}</h3>
        {(log ?? []).length === 0 ? (
          <p className={styles.muted}>{t.localApi.noLog}</p>
        ) : (
          <>
            <ul className={styles.providerList} aria-label={t.localApi.log}>
              {(log ?? []).slice(0, 10).map((e, i) => (
                <li key={`${e.at}-${i}`} className={styles.muted}>
                  {dateTime.format(e.at)} · {e.token} · {e.method} {e.route}
                  {e.module ? ` (${getManifest(e.module)?.name ?? e.module})` : ''} · {e.status}
                  {e.count !== undefined ? ` · ${e.count}` : ''}
                </li>
              ))}
            </ul>
            <div className={styles.row}>
              <Button onClick={() => void clearLog()}>{t.localApi.clearLog}</Button>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={t.localApi.newToken}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>{t.actions.cancel}</Button>
            <Button variant="primary" onClick={() => void submitDraft()}>
              {t.localApi.create}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className={styles.form}>
            <TextField
              label={t.localApi.tokenName}
              hint={t.localApi.tokenNameHint}
              value={draft.name}
              data-autofocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <SelectField
              label={t.localApi.expiry}
              value={draft.expiry}
              onChange={(e) => setDraft({ ...draft, expiry: e.target.value })}
            >
              {EXPIRY_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {c === 'never' ? t.localApi.expiryNever : t.localApi.expiryDays(Number(c))}
                </option>
              ))}
            </SelectField>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{t.localApi.rights}</legend>
              <p className={styles.muted}>{t.localApi.rightsHint}</p>
              {modules.length === 0 ? <p className={styles.muted}>{t.localApi.noModules}</p> : null}
              {modules.map((m) => (
                <div key={m.id} className={styles.row}>
                  <span style={{ minWidth: '10rem' }}>{m.name}</span>
                  <Checkbox
                    label={t.localApi.read}
                    aria-label={`${m.name}: ${t.localApi.read}`}
                    checked={draft.grants[m.id]?.read ?? false}
                    onChange={(e) => setGrant(m.id, 'read', e.target.checked)}
                  />
                  <Checkbox
                    label={t.localApi.write}
                    aria-label={`${m.name}: ${t.localApi.write}`}
                    checked={draft.grants[m.id]?.write ?? false}
                    onChange={(e) => setGrant(m.id, 'write', e.target.checked)}
                  />
                </div>
              ))}
            </fieldset>
            <Checkbox
              label={t.localApi.autoCommit}
              checked={draft.autoCommit}
              onChange={(e) => setDraft({ ...draft, autoCommit: e.target.checked })}
            />
            {draft.autoCommit ? (
              <p className={styles.error}>{t.localApi.autoCommitWarning}</p>
            ) : null}
            {draftError ? (
              <p className={styles.error} role="alert">
                {draftError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={shown !== null}
        onClose={() => setShown(null)}
        title={t.localApi.newToken}
        footer={
          <Button variant="primary" onClick={() => setShown(null)}>
            {t.localApi.done}
          </Button>
        }
      >
        <div className={styles.form}>
          <p>{t.localApi.shownOnce}</p>
          <code data-testid="new-token" style={{ wordBreak: 'break-all', userSelect: 'all' }}>
            {shown}
          </code>
          <p className={styles.muted}>{t.localApi.shownOnceHint}</p>
          <div className={styles.row}>
            <Button
              onClick={() => {
                if (!shown) return;
                void getPlatform()
                  .clipboard.writeSensitive(shown, 60_000)
                  .then(() => toast(t.localApi.copied));
              }}
            >
              {t.localApi.copy}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.kind === 'renew' ? t.localApi.renew : t.localApi.revoke}
        footer={
          <>
            <Button onClick={() => setPending(null)}>{t.actions.cancel}</Button>
            <Button variant="danger" onClick={() => void confirmPending()}>
              {pending?.kind === 'renew' ? t.localApi.renew : t.localApi.revoke}
            </Button>
          </>
        }
      >
        <p>
          {pending
            ? pending.kind === 'renew'
              ? t.localApi.renewConfirm(pending.token.name)
              : t.localApi.revokeConfirm(pending.token.name)
            : null}
        </p>
      </Dialog>
    </Card>
  );
}
