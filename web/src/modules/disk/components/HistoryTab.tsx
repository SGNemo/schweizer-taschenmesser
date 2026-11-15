import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import type { CareEntry, CareHistory } from '@/core/platform/optimize';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, EmptyState, Skeleton } from '@/ui';
import { formatBytes } from '../format';
import styles from './HistoryTab.module.css';

/** What a history line says (read at render time). */
export function entryText(e: CareEntry): string {
  const h = t.disk.history;
  const what = e.subject === 'scan' ? h.fromScan : (t.disk.tidy.category[e.subject] ?? e.subject);
  const size = formatBytes(e.bytes);
  return e.permanent ? h.deleted(what, size, e.files) : h.trashed(what, size, e.files);
}

/**
 * Tab "Verlauf": what the page changed on this PC, newest first, each with its way back. A
 * clean-up went to the recycle bin, so its way back is the recycle bin itself (opened in
 * Explorer). The list is device-local and holds no file names.
 */
export function HistoryTab() {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [history, setHistory] = useState<CareHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const h = t.disk.history;

  useEffect(() => {
    let alive = true;
    optimize
      .history()
      .then((r) => alive && setHistory(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [optimize]);

  const openBin = () => {
    optimize.openTool('recycleBin').catch(() => toast(t.disk.tidy.windows.openFailed));
  };

  return (
    <div className={styles.tab}>
      <p className={styles.lead}>{h.lead}</p>
      {failed ? <p role="alert">{h.failed}</p> : null}
      {!history && !failed ? (
        <div role="status" aria-label={h.loading}>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {history?.recovered ? <p className={styles.note}>{h.recovered}</p> : null}
      {history && history.entries.length === 0 ? (
        <EmptyState title={h.empty}>
          <p>{h.emptyHint}</p>
        </EmptyState>
      ) : null}
      {history && history.entries.length > 0 ? (
        <Card as="div">
          <ul className={styles.list} aria-label={h.listLabel}>
            {history.entries.map((e) => (
              <li key={e.id} className={styles.row}>
                <div className={styles.text}>
                  <span>{entryText(e)}</span>
                  <span className={styles.meta}>
                    {formatTimestamp(e.at * 1000)}
                    {' · '}
                    {e.permanent ? h.noWayBack : h.restoreHint}
                  </span>
                </div>
                {e.kind === 'cleanup' && !e.permanent && optimize.windows ? (
                  <Button onClick={openBin}>{h.restore}</Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
