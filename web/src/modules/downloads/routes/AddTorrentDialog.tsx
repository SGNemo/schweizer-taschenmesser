import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { TorrentPreview, TorrentSource } from '@/core/platform/torrent';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Form, FormActions, TextField } from '@/ui';
import { formatBytes } from '../lib/format';
import styles from './DownloadsPage.module.css';

type Step = 'input' | 'looking' | 'files';

const CODES = ['off', 'file', 'timeout'] as const;

/** Maps a native error code to a sentence the user can act on. */
function errorText(code: string): string {
  const e = t.downloads.torrent.errors;
  if ((CODES as readonly string[]).includes(code)) return e[code as (typeof CODES)[number]];
  if (code === 'not-a-magnet') return e.notMagnet;
  if (code === 'already-added') return e.alreadyAdded;
  if (code === 'dir') return e.dir;
  return e.other;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Magnet link or `.torrent` file → file list (the engine has to find sources for a magnet link first)
 * → choose files and folder → add. Nothing is added before the last click.
 */
export function AddTorrentDialog({
  open,
  defaultFolder,
  initial,
  onClose,
}: {
  open: boolean;
  defaultFolder: string;
  /** Pre-fills the first step (magnet link or `.torrent` path); the user still reviews and confirms. */
  initial?: { kind: 'magnet' | 'file'; value: string } | null;
  onClose: () => void;
}) {
  const platform = getPlatform().torrent;
  const [step, setStep] = useState<Step>('input');
  const [magnet, setMagnet] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<TorrentPreview | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [dir, setDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  // Each look-up has its own token; going back drops the answer of an older one.
  const [token, setToken] = useState(0);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('input');
      setMagnet(initial?.kind === 'magnet' ? initial.value : '');
      setFilePath(initial?.kind === 'file' ? initial.value : null);
      setPreview(null);
      setError(null);
      setDir(defaultFolder);
    }
  }

  const source = (): TorrentSource | null =>
    filePath
      ? { kind: 'file', value: filePath }
      : magnet.trim()
        ? { kind: 'magnet', value: magnet.trim() }
        : null;

  async function look() {
    const src = source();
    if (!src) return;
    const mine = token + 1;
    setToken(mine);
    setError(null);
    setStep('looking');
    try {
      const p = await platform.preview(src);
      if (mine !== token + 1) return;
      setPreview(p);
      setChosen(new Set(p.files.map((f) => f.index)));
      if (!dir)
        setDir(
          await getPlatform()
            .downloads.defaultDir()
            .catch(() => ''),
        );
      setStep('files');
    } catch (e) {
      if (mine !== token + 1) return;
      setError(errorText(message(e)));
      setStep('input');
    }
  }

  async function submit() {
    const src = source();
    if (!src || !preview) return;
    const all = chosen.size === preview.files.length;
    try {
      await platform.add(src, dir, all ? undefined : [...chosen].sort((a, b) => a - b));
      onClose();
    } catch (e) {
      setError(errorText(message(e)));
    }
  }

  const selectedBytes = (preview?.files ?? [])
    .filter((f) => chosen.has(f.index))
    .reduce((n, f) => n + f.size, 0);

  return (
    <Dialog open={open} onClose={onClose} title={t.downloads.torrent.add.title}>
      {step === 'input' ? (
        <Form onSubmit={() => void look()}>
          <TextField
            label={t.downloads.torrent.add.magnet}
            placeholder={t.downloads.torrent.add.magnetPlaceholder}
            value={magnet}
            disabled={filePath !== null}
            onChange={(e) => setMagnet(e.target.value)}
            data-autofocus
          />
          <p className={styles.hint}>{t.downloads.torrent.add.or}</p>
          <div className={styles.bar}>
            <Button
              onClick={() =>
                void platform.pickFile().then((picked) => {
                  if (picked) setFilePath(picked);
                })
              }
            >
              {t.downloads.torrent.add.openFile}
            </Button>
            {filePath ? (
              <span className={styles.sub}>
                {t.downloads.torrent.add.chosen}: {filePath}
              </span>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <FormActions>
            <Button onClick={onClose}>{t.downloads.add.cancel}</Button>
            <Button type="submit" variant="primary" disabled={!source()}>
              {t.downloads.torrent.add.look}
            </Button>
          </FormActions>
        </Form>
      ) : step === 'looking' ? (
        <div className={styles.panel}>
          <p role="status">{t.downloads.torrent.add.looking}</p>
          <FormActions>
            <Button
              onClick={() => {
                setToken(token + 2);
                setStep('input');
              }}
            >
              {t.downloads.torrent.add.back}
            </Button>
          </FormActions>
        </div>
      ) : (
        <Form onSubmit={() => void submit()}>
          <h3>{preview?.name}</h3>
          <div className={styles.bar}>
            <Button onClick={() => setChosen(new Set(preview?.files.map((f) => f.index)))}>
              {t.downloads.torrent.add.all}
            </Button>
            <Button onClick={() => setChosen(new Set())}>{t.downloads.torrent.add.none}</Button>
          </div>
          <fieldset className={styles.files}>
            <legend>{t.downloads.torrent.add.files}</legend>
            {(preview?.files ?? []).map((f) => (
              <Checkbox
                key={f.index}
                label={`${f.path} (${formatBytes(f.size)})`}
                checked={chosen.has(f.index)}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(f.index);
                  else next.delete(f.index);
                  setChosen(next);
                }}
              />
            ))}
          </fieldset>
          <p className={styles.sub}>
            {t.downloads.torrent.add.selected}: {formatBytes(selectedBytes)}
          </p>
          <TextField
            label={t.downloads.add.folder}
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          />
          <div>
            <Button
              onClick={() =>
                void getPlatform()
                  .downloads.pickDir()
                  .then((picked) => {
                    if (picked) setDir(picked);
                  })
              }
            >
              {t.downloads.add.pick}
            </Button>
          </div>
          {chosen.size === 0 ? (
            <p className={styles.sub}>{t.downloads.torrent.add.pickOne}</p>
          ) : null}
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <FormActions>
            <Button onClick={() => setStep('input')}>{t.downloads.torrent.add.back}</Button>
            <Button type="submit" variant="primary" disabled={chosen.size === 0 || !dir}>
              {t.downloads.torrent.add.submit}
            </Button>
          </FormActions>
        </Form>
      )}
    </Dialog>
  );
}
