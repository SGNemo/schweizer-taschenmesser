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
import { splitIntoFrames } from '@/core/share/frames';
import { listChoices, listScopeOf } from '@/core/share/scopes';
import { createPairFile, shareFileName, shareableModules } from '@/core/share/share';
import { QrPlayer } from './ShareQr';
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
  const [choices, setChoices] = useState<Record<string, { id: string; name: string }[]>>({});
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [fresh, setFresh] = useState<{ name: string; code: string } | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<
    { pair: SharePair; frames: string[]; upto: string | undefined; rows: number } | undefined
  >();

  useEffect(() => {
    let live = true;
    void loadPairs().then((p) => live && setPairs(p));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    let live = true;
    void Promise.all(
      chosen
        .filter((id) => listScopeOf(id))
        .map(async (id) => [id, await listChoices(id)] as const),
    ).then((entries) => live && setChoices(Object.fromEntries(entries)));
    return () => {
      live = false;
    };
  }, [chosen]);

  async function create() {
    setError('');
    if (chosen.length === 0) return setError(n.pickModules);
    const picked = Object.fromEntries(
      Object.entries(lists).filter(([id, ids]) => chosen.includes(id) && ids.length > 0),
    );
    const { pair, code } = await createPair({
      name,
      modules: chosen,
      ...(Object.keys(picked).length > 0 ? { lists: picked } : {}),
    });
    setFresh({ name: pair.name, code });
    setName('');
    setChosen([]);
    setLists({});
    onChanged();
  }

  async function send(pair: SharePair, all: boolean) {
    const code = await pairCode(pair.id);
    if (!code) return;
    setBusy(true);
    try {
      const since = all ? undefined : pair.sentUpto;
      const file = await createPairFile({
        modules: pair.modules,
        code,
        pairId: pair.id,
        since,
        lists: pair.lists,
      });
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

  /** The same file as `send`, shown as a run of QR codes; counted as handed over when "Fertig gezeigt" is tapped. */
  async function showQr(pair: SharePair) {
    const code = await pairCode(pair.id);
    if (!code) return;
    setBusy(true);
    try {
      const file = await createPairFile({
        modules: pair.modules,
        code,
        pairId: pair.id,
        since: pair.sentUpto,
        lists: pair.lists,
      });
      if (file.rows === 0 && pair.sentUpto) return toast(n.pairNothing);
      setQr({ pair, frames: splitIntoFrames(file.text), upto: file.upto, rows: file.rows });
    } finally {
      setBusy(false);
    }
  }

  async function qrDone() {
    if (!qr) return;
    await updatePair(qr.pair.id, { sentUpto: qr.upto, sentAt: now() });
    toast(n.qrSent(qr.rows));
    setQr(undefined);
    onChanged();
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
              {p.lists && Object.keys(p.lists).length > 0 ? ` · ${n.listsOnly}` : ''}
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
                <Button disabled={busy} onClick={() => void showQr(p)}>
                  {n.qrShow}
                </Button>
                <Button onClick={() => void remove(p)}>{n.remove(p.name)}</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {qr ? <QrPlayer frames={qr.frames} onDone={() => void qrDone()} /> : null}
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
          <div key={m.id}>
            <Checkbox
              label={m.name}
              checked={chosen.includes(m.id)}
              onChange={(e) =>
                setChosen((cur) =>
                  e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id),
                )
              }
            />
            {chosen.includes(m.id) && (choices[m.id]?.length ?? 0) > 0 ? (
              <fieldset className={styles.fieldset} data-testid={`share-lists-${m.id}`}>
                <legend className={styles.muted}>{n.listsHint}</legend>
                {choices[m.id]!.map((l) => (
                  <Checkbox
                    key={l.id}
                    label={l.name}
                    checked={lists[m.id]?.includes(l.id) ?? false}
                    onChange={(e) =>
                      setLists((cur) => {
                        const picked = cur[m.id] ?? [];
                        return {
                          ...cur,
                          [m.id]: e.target.checked
                            ? [...picked, l.id]
                            : picked.filter((x) => x !== l.id),
                        };
                      })
                    }
                  />
                ))}
              </fieldset>
            ) : null}
          </div>
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
