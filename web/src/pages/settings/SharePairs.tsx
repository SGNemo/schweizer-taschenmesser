import { useEffect, useState } from 'react';
import { downloadTextFile } from '@/core/backup/download';
import { DATE_TIME_NUMERIC, formatTimestamp } from '@/core/i18n/format';
import { allManifests } from '@/core/modules/registry';
import {
  createPair,
  loadPairs,
  pairCode,
  removePair,
  updatePair,
  type SharePair,
} from '@/core/share/pairs';
import { createPairFile, shareFileName, shareableModules } from '@/core/share/share';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { tShare } from '@/strings.share';
import { Button, Checkbox, NoReadAid, TextField } from '@/ui';
import styles from './settings.module.css';

const moduleName = (id: string) => allManifests.find((m) => m.id === id)?.name ?? id;

/** Standing connections: create one, save "what changed" as a file, remove it. */
export function SharePairs({ version, onChanged }: { version: number; onChanged: () => void }) {
  const n = tShare.use();
  const toast = useUiStore((s) => s.toast);
  const modules = shareableModules();
  const [pairs, setPairs] = useState<SharePair[]>([]);
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [fresh, setFresh] = useState<{ name: string; code: string } | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPairs().then((p) => live && setPairs(p));
    return () => {
      live = false;
    };
  }, [version]);

  async function create() {
    setError('');
    if (chosen.length === 0) return setError(n.pickModules);
    const { pair, code } = await createPair({ name, modules: chosen });
    setFresh({ name: pair.name, code });
    setName('');
    setChosen([]);
    onChanged();
  }

  async function send(pair: SharePair, all: boolean) {
    const code = await pairCode(pair.id);
    if (!code) return;
    setBusy(true);
    try {
      const since = all ? undefined : pair.sentUpto;
      const file = await createPairFile({ modules: pair.modules, code, pairId: pair.id, since });
      if (file.rows === 0 && since) return toast(n.pairNothing);
      const result = await downloadTextFile(shareFileName(), file.text);
      if (result !== 'saved') return;
      await updatePair(pair.id, { sentUpto: file.upto, sentAt: now() });
      toast(n.sent(file.rows));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(pair: SharePair) {
    await removePair(pair.id);
    toast(n.pairRemoved);
    onChanged();
  }

  const when = (at: number | undefined, never: string, label: (w: string) => string) =>
    at === undefined ? never : label(formatTimestamp(at, DATE_TIME_NUMERIC));

  return (
    <div className={styles.form} data-testid="share-pairs">
      <p className={styles.legend}>{n.pairsTitle}</p>
      <p className={styles.muted}>{n.pairsHint}</p>
      {pairs.length > 0 ? (
        <ul>
          {pairs.map((p) => (
            <li key={p.id} data-testid="share-pair">
              <strong>{p.name}</strong> · {p.modules.map(moduleName).join(', ')}
              <br />
              <span className={styles.muted}>
                {when(p.sentAt, n.pairNeverSent, n.lastSent)} ·{' '}
                {when(p.receivedAt, n.pairNeverReceived, n.lastReceived)}
              </span>
              <div className={styles.row}>
                <Button disabled={busy} onClick={() => void send(p, false)}>
                  {n.pairSend}
                </Button>
                <Button disabled={busy} onClick={() => void send(p, true)}>
                  {n.pairResend}
                </Button>
                <Button onClick={() => void remove(p)}>{n.remove(p.name)}</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {fresh ? (
        <div role="status" data-testid="share-pair-code">
          <p className={styles.legend}>{`${n.code}: ${fresh.name}`}</p>
          <NoReadAid>
            <p>
              <strong>{fresh.code}</strong>
            </p>
          </NoReadAid>
          <p className={styles.muted}>{n.codeHint}</p>
        </div>
      ) : null}
      <TextField label={n.pairName} value={name} onChange={(e) => setName(e.target.value)} />
      <fieldset className={styles.fieldset}>
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
      </fieldset>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.row}>
        <Button disabled={!name.trim()} onClick={() => void create()}>
          {n.pairCreate}
        </Button>
      </div>
    </div>
  );
}
