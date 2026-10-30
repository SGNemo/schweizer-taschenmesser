import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { downloadTextFile } from '@/core/backup/download';
import type { RestorePlan } from '@/core/backup/restore';
import type { Backup } from '@/core/backup/backup';
import { allManifests } from '@/core/modules/registry';
import { joinPair, loadPairs, pairCode, updatePair, type SharePair } from '@/core/share/pairs';
import { SharePairs } from './SharePairs';
import {
  applyShare,
  createShareFile,
  followsReceived,
  newPairingCode,
  peekPairId,
  planShare,
  readShareFile,
  type ShareRange,
  shareFileName,
  shareableModules,
} from '@/core/share/share';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tShare } from '@/strings.share';
import { Button, Card, Checkbox, NoReadAid, TextField } from '@/ui';
import styles from './settings.module.css';

const moduleLabel = (id: string): string => allManifests.find((m) => m.id === id)?.name ?? id;

/** Settings → Verbindungen → "Mit Partner teilen": a file and a code instead of a server. */
export function ShareSection() {
  const n = tShare.use();
  const toast = useUiStore((s) => s.toast);
  const modules = useMemo(() => shareableModules(), []);
  const [chosen, setChosen] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState<string | undefined>();
  const [openCode, setOpenCode] = useState('');
  const [opened, setOpened] = useState<
    | {
        backup: Backup;
        plan: RestorePlan;
        modules: string[];
        pairId?: string;
        range: ShareRange;
        code: string;
      }
    | undefined
  >();
  const [pairs, setPairs] = useState<SharePair[]>([]);
  const [version, setVersion] = useState(0);
  const [joinName, setJoinName] = useState('');
  const knownPair = (text && pairs.find((p) => p.id === peekPairId(text))) || undefined;
  const newPairId = text && !knownPair ? peekPairId(text) : undefined;
  const [openError, setOpenError] = useState('');

  useEffect(() => {
    let live = true;
    void loadPairs().then((p) => live && setPairs(p));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    let live = true;
    void newPairingCode().then((c) => live && setCode(c));
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    setError('');
    if (chosen.length === 0) return setError(n.pickModules);
    setBusy(true);
    try {
      const file = await createShareFile({ modules: chosen, code });
      const result = await downloadTextFile(shareFileName(), file);
      if (result === 'saved') toast(n.saved);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!text) return;
    setOpenError('');
    setOpened(undefined);
    setBusy(true);
    try {
      const stored = knownPair ? await pairCode(knownPair.id) : undefined;
      const code = stored ?? openCode;
      const read = await readShareFile(text, code);
      if (!read.ok) return setOpenError(n.errors[read.reason] ?? n.errors.failed!);
      if (knownPair && !followsReceived(read.range, knownPair.receivedUpto))
        return setOpenError(n.errors.gap!);
      setOpened({
        backup: read.backup,
        plan: await planShare(read.backup),
        modules: read.modules,
        pairId: read.pairId,
        range: read.range,
        code,
      });
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!opened) return;
    setBusy(true);
    try {
      const { records } = await applyShare(opened.backup);
      if (opened.pairId) {
        const pair =
          knownPair ??
          (await joinPair({
            id: opened.pairId,
            name: joinName,
            modules: opened.modules,
            code: opened.code,
          }));
        const upto = [pair.receivedUpto, opened.range.upto]
          .filter((x): x is string => x !== undefined)
          .sort()
          .at(-1);
        await updatePair(pair.id, { receivedUpto: upto, receivedAt: now() });
        setVersion((v) => v + 1);
      }
      setOpened(undefined);
      setText(undefined);
      setOpenCode('');
      toast(n.done(records));
    } catch {
      setOpenError(n.errors.failed!);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setOpened(undefined);
    setOpenError('');
    const file = e.target.files?.[0];
    setText(file ? await file.text() : undefined);
  }

  const changed = opened?.plan.modules.filter((m) => m.added + m.replaced > 0) ?? [];
  return (
    <Card>
      <div className={styles.form}>
        <p>{n.description}</p>

        <SharePairs version={version} onChanged={() => setVersion((v) => v + 1)} />

        <fieldset className={styles.fieldset} data-testid="share-once-modules">
          <legend className={styles.legend}>{n.modules}</legend>
          {modules.map((m) => (
            <Checkbox
              key={m.id}
              label={m.name}
              checked={chosen.includes(m.id)}
              onChange={(e) =>
                setChosen((cur) =>
                  e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id),
                )
              }
            />
          ))}
          <p className={styles.muted}>{n.modulesHint}</p>
        </fieldset>

        <div>
          <p className={styles.legend}>{n.code}</p>
          <NoReadAid>
            <p data-testid="share-code">
              <strong>{code}</strong>
            </p>
          </NoReadAid>
          <p className={styles.muted}>{n.codeHint}</p>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <div className={styles.row}>
          <Button variant="primary" disabled={busy || !code} onClick={() => void save()}>
            {n.save}
          </Button>
          <Button disabled={busy} onClick={() => void newPairingCode().then(setCode)}>
            {n.newCode}
          </Button>
        </div>

        <p className={styles.legend}>{n.openTitle}</p>
        <div>
          <label htmlFor="share-file" className={styles.legend}>
            {n.file}
          </label>
          <br />
          <input
            id="share-file"
            type="file"
            accept="application/json,.json"
            className={styles.file}
            onChange={(e) => void onFile(e)}
          />
        </div>
        {knownPair ? <p className={styles.muted}>{n.known(knownPair.name)}</p> : null}
        {newPairId ? <p className={styles.muted}>{n.pairNew}</p> : null}
        {newPairId ? (
          <TextField
            label={n.pairNameJoin}
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
          />
        ) : null}
        {knownPair ? null : (
          <TextField
            label={n.openCode}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={openCode}
            onChange={(e) => {
              setOpenCode(e.target.value);
              setOpened(undefined);
            }}
          />
        )}
        {openError ? (
          <p role="alert" className={styles.error} data-testid="share-error">
            {openError}
          </p>
        ) : null}
        <div className={styles.row}>
          <Button
            disabled={busy || !text || (!knownPair && !openCode.trim())}
            onClick={() => void check()}
          >
            {busy && !opened ? n.checking : n.check}
          </Button>
        </div>
        {opened ? (
          <div data-testid="share-plan">
            <p className={styles.legend}>{n.preview}</p>
            {changed.length === 0 ? (
              <p className={styles.muted}>{n.previewNothing}</p>
            ) : (
              <ul className={styles.muted}>
                {changed.map((m) => (
                  <li key={m.module}>
                    {t.backup.previewRow(moduleLabel(m.module), m.added, m.replaced, 0)}
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>{n.mergeHint}</p>
            <div className={styles.row}>
              <Button variant="primary" disabled={busy} onClick={() => void merge()}>
                {busy ? n.merging : n.merge}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
