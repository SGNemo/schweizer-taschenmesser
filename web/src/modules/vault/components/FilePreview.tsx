import { useEffect, useState } from 'react';
import { getBlob } from '@/core/blobs';
import { t } from '@/strings';
import { Button, NoReadAid } from '@/ui';
import styles from '../routes/VaultPage.module.css';

/** Only pictures have a preview: the app shows no documents in frames (content security policy). */
export const canPreview = (fileType: string | undefined): boolean =>
  !!fileType && /^image\/(jpeg|png|webp|gif)$/.test(fileType);

/**
 * The picture of a filed document, only after a tap: a passport is not for whoever happens to look at the screen.
 * It lives in memory while it is shown (an object URL, revoked when hidden or left) and is written nowhere: not
 * to a setting, a draft, the sync, the backup, the search or a report. The reading aid never touches it.
 */
export function FilePreview({ id, fileName }: { id: string; fileName: string }) {
  const [url, setUrl] = useState<string>();
  const [missing, setMissing] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function show() {
    const blob = await getBlob(id);
    if (!blob) return setMissing(true);
    setUrl(URL.createObjectURL(blob));
  }

  return (
    <NoReadAid>
      <div className={styles.preview} data-testid="file-preview">
        <Button
          size="sm"
          aria-expanded={url !== undefined}
          onClick={() => (url ? setUrl(undefined) : void show())}
        >
          {url ? t.vault.preview.hide : t.vault.preview.show}
        </Button>
        {missing ? <p role="status">{t.vault.preview.missing}</p> : null}
        {url ? <img src={url} alt={t.vault.preview.alt(fileName)} /> : null}
      </div>
    </NoReadAid>
  );
}
