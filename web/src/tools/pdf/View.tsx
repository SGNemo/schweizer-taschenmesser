import { useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon, IconButton, SelectField, Segmented, TextField } from '@/ui';
import styles from '../tools.module.css';
import { outName, parseRanges, without, type Rotation } from './logic';
import { PdfError, extractPages, mergePdfs, pageCount, rotatePages } from './pdf';

const s = t.tools.pdf;
type Mode = 'merge' | 'pages' | 'rotate';
interface Loaded {
  name: string;
  bytes: Uint8Array;
}

const read = async (f: File): Promise<Loaded> => ({
  name: f.name,
  bytes: new Uint8Array(await f.arrayBuffer()),
});
const message = (e: unknown) =>
  e instanceof PdfError ? (s.errors[e.code] ?? s.errors.invalid!) : s.errors.invalid!;

export default function PdfTool() {
  const [mode, setMode] = useState<Mode>('merge');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useUiStore((st) => st.toast);

  async function save(bytes: Uint8Array, fileName: string) {
    const r = await getPlatform().saveFile({ fileName, data: bytes, mime: 'application/pdf' });
    if (r === 'saved') toast(s.saved);
  }

  /** Runs one editing step with the shared busy/error handling. */
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stack}>
      <Segmented
        label={s.mode}
        value={mode}
        options={[
          { value: 'merge' as const, label: s.merge },
          { value: 'pages' as const, label: s.pages },
          { value: 'rotate' as const, label: s.rotate },
        ]}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />
      {mode === 'merge' ? (
        <Merge run={run} save={save} busy={busy} />
      ) : (
        <Single mode={mode} run={run} save={save} busy={busy} />
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {busy ? (
        <p className={styles.muted} role="status">
          {s.busy}
        </p>
      ) : null}
    </div>
  );
}

interface StepProps {
  run: (work: () => Promise<void>) => Promise<void>;
  save: (bytes: Uint8Array, fileName: string) => Promise<void>;
  busy: boolean;
}

function Merge({ run, save, busy }: StepProps) {
  const [files, setFiles] = useState<Loaded[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tooFew, setTooFew] = useState(false);

  async function pick(list: FileList | null) {
    setTooFew(false);
    await run(async () => {
      const loaded = await Promise.all([...(list ?? [])].map(read));
      setFiles((old) => [...old, ...loaded]);
    });
  }
  const move = (i: number, d: number) =>
    setFiles((f) => {
      const next = [...f];
      const [item] = next.splice(i, 1);
      next.splice(i + d, 0, item!);
      return next;
    });

  return (
    <>
      <div>
        <Button onClick={() => inputRef.current?.click()}>{s.pickMany}</Button>
        <input
          ref={inputRef}
          id="pdf-merge-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className={styles.list} aria-label={s.files} data-testid="pdf-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={styles.item}>
              <span>
                {i + 1}. {f.name}
              </span>
              <span>
                <IconButton label={s.up(f.name)} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="chevronUp" size={16} />
                </IconButton>
                <IconButton
                  label={s.down(f.name)}
                  disabled={i === files.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <Icon name="chevronDown" size={16} />
                </IconButton>
                <IconButton
                  label={s.removeFile(f.name)}
                  onClick={() => setFiles((all) => all.filter((_, k) => k !== i))}
                >
                  <Icon name="close" size={16} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {tooFew ? (
        <p className={styles.error} role="alert">
          {s.errors.tooFew}
        </p>
      ) : null}
      <div className={styles.row}>
        <Button
          variant="primary"
          disabled={busy || files.length === 0}
          onClick={() => {
            if (files.length < 2) return setTooFew(true);
            void run(async () =>
              save(
                await mergePdfs(files.map((f) => f.bytes)),
                outName(files[0]!.name, 'zusammengefuegt'),
              ),
            );
          }}
        >
          {s.doMerge}
        </Button>
      </div>
    </>
  );
}

function Single({ mode, run, save, busy }: StepProps & { mode: 'pages' | 'rotate' }) {
  const [file, setFile] = useState<(Loaded & { count: number }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [range, setRange] = useState('');
  const [keep, setKeep] = useState<'keep' | 'drop'>('keep');
  const [angle, setAngle] = useState<Rotation>(90);
  const [bad, setBad] = useState(false);

  async function pick(f: File | undefined) {
    setFile(null);
    setBad(false);
    if (!f) return;
    await run(async () => {
      const loaded = await read(f);
      setFile({ ...loaded, count: await pageCount(loaded.bytes) });
    });
  }

  async function apply() {
    if (!file) return;
    const pages =
      range.trim() === '' && mode === 'rotate'
        ? Array.from({ length: file.count }, (_, i) => i + 1)
        : parseRanges(range, file.count);
    setBad(!pages);
    if (!pages) return;
    await run(async () => {
      if (mode === 'rotate')
        await save(await rotatePages(file.bytes, pages, angle), outName(file.name, 'gedreht'));
      else
        await save(
          await extractPages(file.bytes, keep === 'keep' ? pages : without(file.count, pages)),
          outName(file.name, keep === 'keep' ? 'auswahl' : 'gekuerzt'),
        );
    });
  }

  return (
    <>
      <div>
        <Button onClick={() => inputRef.current?.click()}>{s.pickOne}</Button>
        <input
          ref={inputRef}
          id="pdf-single-input"
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
      {file ? (
        <>
          <p className={styles.muted} data-testid="pdf-info">
            {file.name} · {s.pageCount(file.count)}
          </p>
          <TextField
            label={s.range}
            hint={mode === 'rotate' ? s.rangeRotateHint : s.rangeHint}
            value={range}
            onChange={(e) => setRange(e.target.value)}
            error={bad ? s.badRange(file.count) : undefined}
            autoComplete="off"
          />
          {mode === 'pages' ? (
            <Segmented
              label={s.action}
              value={keep}
              options={[
                { value: 'keep' as const, label: s.keep },
                { value: 'drop' as const, label: s.drop },
              ]}
              onChange={setKeep}
            />
          ) : (
            <SelectField
              label={s.angle}
              value={String(angle)}
              onChange={(e) => setAngle(Number(e.target.value) as Rotation)}
            >
              {(['90', '180', '270'] as const).map((a) => (
                <option key={a} value={a}>
                  {s.angles[a]}
                </option>
              ))}
            </SelectField>
          )}
          <div className={styles.row}>
            <Button variant="primary" disabled={busy} onClick={() => void apply()}>
              {mode === 'rotate' ? s.doRotate : s.doPages}
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
