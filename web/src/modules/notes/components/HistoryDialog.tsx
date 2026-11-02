import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/core/i18n/format';
import { t } from '@/strings';
import { Button, Dialog, EmptyState } from '@/ui';
import { markdownToPlain } from '../editor/markdown';
import { loadVersions, type Version } from '../editor/versions';
import styles from './Dialogs.module.css';

/** The last 20 saved states of a page (this device only). Restoring goes through the editor, so Ctrl+Z undoes it. */
export function HistoryDialog({
  open,
  pageId,
  onClose,
  onRestore,
}: {
  open: boolean;
  pageId: string;
  onClose: () => void;
  onRestore: (v: Version) => void;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadVersions(pageId).then((list) => {
      if (cancelled) return;
      setVersions(list);
      setPicked(0);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  const current = versions?.[picked];
  return (
    <Dialog open={open} onClose={onClose} title={t.notes.historyTitle}>
      {versions && versions.length === 0 ? <EmptyState title={t.notes.historyEmpty} /> : null}
      {versions && versions.length > 0 ? (
        <div className={styles.history}>
          <ul className={styles.versionList} aria-label={t.notes.historyTitle}>
            {versions.map((v, i) => (
              <li key={v.at}>
                <button
                  type="button"
                  className={styles.versionBtn}
                  aria-pressed={i === picked}
                  onClick={() => setPicked(i)}
                >
                  {formatTimestamp(v.at)}
                  {i === 0 ? ` · ${t.notes.historyCurrent}` : ''}
                </button>
              </li>
            ))}
          </ul>
          <pre className={styles.preview}>
            {current ? markdownToPlain(current.body).slice(0, 1200) : ''}
          </pre>
          <div className={styles.actions}>
            <Button onClick={onClose}>{t.actions.cancel}</Button>
            <Button
              variant="primary"
              disabled={!current}
              onClick={() => current && onRestore(current)}
            >
              {t.notes.historyRestore}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
