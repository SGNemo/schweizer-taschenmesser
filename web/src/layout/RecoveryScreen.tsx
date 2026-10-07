import { useRef, useState } from 'react';
import { scrub } from '@/core/diagnostics/errorLog';
import { reportBug } from '@/core/diagnostics/report';
import { dumpDb, repairDb, replaceWithEmptyDb, type DbProblem } from '@/core/db/health';
import { keepBrokenCopy, restoreIntoFreshDb } from '@/core/db/recovery';
import { NoReadAid } from '@/core/text/ReadableText';
import { tDiag } from '@/strings.diagnostics';
import { Button, Card, Logo, TextField, TypedConfirmDialog } from '@/ui';
import styles from './RecoveryScreen.module.css';

/**
 * Shown instead of the app when the local database cannot be opened or read. Every step that
 * changes something first asks for a copy of the defective state; nothing happens without it.
 */
export function RecoveryScreen({ problem }: { problem: DbProblem }) {
  const d = tDiag.use();
  const r = d.recovery;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [pass, setPass] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const pending = useRef<string | undefined>(undefined);

  const restart = () => void setTimeout(() => location.reload(), 600);

  async function safely(step: () => Promise<void>) {
    setBusy(true);
    setMessage(undefined);
    try {
      await step();
    } finally {
      setBusy(false);
    }
  }

  const repair = () =>
    safely(async () => {
      if (!(await keepBrokenCopy(await dumpDb()))) return setMessage(r.copyCancelled);
      if (await repairDb()) return setMessage(r.repairFailed);
      setMessage(r.repairDone);
      restart();
    });

  const restore = (text: string, passphrase?: string) =>
    safely(async () => {
      const out = await restoreIntoFreshDb(text, passphrase);
      if (out.ok) {
        setMessage(r.repairDone);
        return restart();
      }
      if (out.reason === 'passphrase-required') setNeedPass(true);
      setMessage(r.errors[out.reason]);
    });

  async function onFile(f: File | undefined) {
    if (!f) return;
    pending.current = await f.text();
    setNeedPass(false);
    await restore(pending.current, pass || undefined);
  }

  async function resetEmpty() {
    if (!(await keepBrokenCopy(await dumpDb()))) {
      setMessage(r.copyCancelled);
      return;
    }
    await replaceWithEmptyDb();
    location.reload();
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.head}>
          <Logo size={48} title="Nemo" />
          <h1>{r.title}</h1>
        </div>
        <p>{r.intro}</p>
        <NoReadAid>
          <p className={styles.detail} data-testid="recovery-detail">
            {r.details}: {problem.name}
            {problem.tables.length ? ` (${problem.tables.join(', ')})` : ''} –{' '}
            {scrub(problem.message)}
          </p>
        </NoReadAid>
        {message && (
          <p role="status" data-testid="recovery-message">
            {message}
          </p>
        )}
        <Card title={r.repair}>
          <p className={styles.hint}>{r.repairHint}</p>
          <Button variant="primary" disabled={busy} onClick={() => void repair()}>
            {r.repair}
          </Button>
        </Card>
        <Card title={r.restore}>
          <p className={styles.hint}>{r.restoreHint}</p>
          {needPass && (
            <TextField
              label={r.passphrase}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          )}
          <div className={styles.row}>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              data-testid="recovery-file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button disabled={busy} onClick={() => file.current?.click()}>
              {r.restore}
            </Button>
            {needPass && (
              <Button disabled={busy || !pass} onClick={() => void restore(pending.current!, pass)}>
                {r.restore}
              </Button>
            )}
          </div>
        </Card>
        <Card title={r.reset}>
          <p className={styles.hint}>{r.resetHint}</p>
          <div className={styles.row}>
            <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
              {r.reset}
            </Button>
            <Button onClick={() => void reportBug(`${problem.name}: ${problem.message}`)}>
              {r.report}
            </Button>
          </div>
        </Card>
        <TypedConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title={r.resetTitle}
          phrase={r.resetPhrase}
          confirmLabel={r.resetConfirm}
          onConfirm={resetEmpty}
        >
          <p>{r.resetWarning}</p>
        </TypedConfirmDialog>
      </div>
    </main>
  );
}
