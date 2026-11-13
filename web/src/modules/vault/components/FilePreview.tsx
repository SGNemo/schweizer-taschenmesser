import { useEffect, useRef, useState } from 'react';
import { getBlob } from '@/core/blobs';
import { t } from '@/strings';
import { Button, NoReadAid } from '@/ui';
import styles from './Deadlines.module.css';

/** Only pictures have a preview: the app shows no documents in frames (content security policy). */
export const canPreview = (fileType: string | undefined): boolean =>
  !!fileType && /^image\/(jpeg|png|webp|gif)$/.test(fileType);

/**
 * The picture of a filed document, only after a tap: a passport is not for whoever happens to look at the screen.
 * It lives in memory while it is shown (an object URL, revoked when hidden or left) and is written nowhere: not
 * to a setting, a draft, the sync, the backup, the search or a report. The reading aid never touches it.
 *
 * `fileType` of the record is synced, the file is not: what decides is the type of the file that lies here.
 */
export function FilePreview({ id, fileName }: { id: string; fileName: string }) {
  const [url, setUrl] = useState<string>();
  const [note, setNote] = useState('');
  // One read at a time: a second tap while the file is read would make a second URL nobody gives back.
  const [busy, setBusy] = useState(false);
  const reading = useRef(false);
  // Left before the file was read (the panel closed, another folder picked): no URL is made afterwards.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function show() {
    // Two taps in one go see the same `busy`: the ref is what lets only one read start.
    if (reading.current) return;
    reading.current = true;
    setNote('');
    setBusy(true);
    const blob = await getBlob(id).catch(() => undefined);
    reading.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (!blob) return setNote(t.vault.preview.missing);
    if (!canPreview(blob.type)) return setNote(t.vault.preview.noPicture);
    setUrl(URL.createObjectURL(blob));
  }

  return (
    <NoReadAid>
      <div className={styles.preview} data-testid="file-preview">
        <Button
          size="sm"
          aria-expanded={url !== undefined}
          // Not `disabled`: the button keeps the keyboard focus while the file is read; a tap then does nothing.
          aria-disabled={busy || undefined}
          onClick={() => {
            if (busy) return;
            if (url) setUrl(undefined);
            else void show();
          }}
        >
          {url ? t.vault.preview.hide : t.vault.preview.show}
        </Button>
        {/* Always there, so a screen reader hears the text when it changes. */}
        <p role="status">{busy ? t.vault.preview.loading : note}</p>
        {url ? <img src={url} alt={t.vault.preview.alt(fileName)} /> : null}
      </div>
    </NoReadAid>
  );
}
