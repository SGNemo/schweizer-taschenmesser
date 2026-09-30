import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/core/db/db';
import { moduleOfTable } from '@/core/backup/apply';
import {
  dismissAllConflicts,
  dismissConflict,
  listConflicts,
  restoreConflict,
  type ConflictRow,
} from '@/core/sync/conflicts';
import { allManifests } from '@/core/modules/registry';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './settings.module.css';

const moduleLabel = (collection: string): string => {
  const id = moduleOfTable(collection);
  return id === 'core' ? t.backup.core : (allManifests.find((m) => m.id === id)?.name ?? id);
};

function show(value: unknown, field: string, truncated?: boolean): string {
  if (truncated) return t.sync.conflictTooLarge;
  if (field === 'deletedAt') return value === null ? t.sync.conflictEmpty : t.sync.conflictDeleted;
  if (value === null || value === undefined || value === '') return t.sync.conflictEmpty;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** Where last-write-wins overwrote a value, with restore. Shown while connected. */
export function SyncConflicts() {
  const toast = useUiStore((s) => s.toast);
  const conflicts = useLiveQuery(() => listConflicts(db), []);
  const [note, setNote] = useState<string | undefined>();

  async function restore(c: ConflictRow) {
    const outcome = await restoreConflict(c.id!);
    if (outcome === 'restored') {
      setNote(undefined);
      toast(t.sync.conflictRestored);
    } else setNote(t.sync.conflictOutcome[outcome]);
  }

  if (conflicts === undefined) return null;
  return (
    <div className={styles.form} data-testid="sync-conflicts">
      <p className={styles.legend}>{t.sync.conflictsTitle}</p>
      <p className={styles.muted}>{t.sync.conflictsIntro}</p>
      {conflicts.length === 0 ? <p className={styles.muted}>{t.sync.conflictsNone}</p> : null}
      {conflicts.map((c) => (
        <div key={c.id} className={styles.provider} data-testid="conflict-row">
          <strong>
            {moduleLabel(c.collection)} · {c.field}
          </strong>
          <span className={styles.muted}>{t.sync.conflictKept[c.kept]}</span>
          <span>
            {t.sync.conflictLost}: {show(c.lostValue, c.field, c.truncated)}
          </span>
          <span className={styles.muted}>
            {t.sync.conflictNow}: {show(c.keptValue, c.field)}
          </span>
          <div className={styles.row}>
            <Button variant="primary" disabled={c.truncated} onClick={() => void restore(c)}>
              {t.sync.conflictRestore}
            </Button>
            <Button onClick={() => void dismissConflict(c.id!)}>{t.sync.conflictDismiss}</Button>
          </div>
        </div>
      ))}
      {conflicts.length > 1 ? (
        <div className={styles.row}>
          <Button onClick={() => void dismissAllConflicts()}>{t.sync.conflictDismissAll}</Button>
        </div>
      ) : null}
      {note ? (
        <p role="status" className={styles.muted}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
