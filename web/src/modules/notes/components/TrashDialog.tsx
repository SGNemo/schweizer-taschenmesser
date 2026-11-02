import { useCallback, useEffect, useState } from 'react';
import { listTrash, restoreEntry, type TrashEntry } from '@/core/trash/trash';
import { t } from '@/strings';
import { Button, Dialog, EmptyState } from '@/ui';
import styles from './Dialogs.module.css';

/** Deleted pages (the shared "Zuletzt gelöscht" window) with a restore button. */
export function TrashDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<TrashEntry[] | null>(null);
  const reload = useCallback(
    () => listTrash().then((all) => all.filter((e) => e.kind === 'note')),
    [],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void reload().then((list) => {
      if (!cancelled) setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, reload]);

  return (
    <Dialog open={open} onClose={onClose} title={t.notes.trashTitle}>
      {entries && entries.length === 0 ? <EmptyState title={t.notes.trashEmpty} /> : null}
      {entries && entries.length > 0 ? (
        <ul className={styles.trashList} aria-label={t.notes.trashTitle}>
          {entries.map((e) => (
            <li key={e.id} className={styles.trashRow}>
              <span>
                {e.title || t.notes.untitled}
                <br />
                <span className={styles.trashMeta}>{t.notes.trashDays(e.daysLeft)}</span>
              </span>
              <Button
                onClick={async () => {
                  await restoreEntry(e);
                  setEntries(await reload());
                }}
              >
                {t.notes.trashRestore}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
}
