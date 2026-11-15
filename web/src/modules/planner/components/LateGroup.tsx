import { type ReactNode, useId, useState } from 'react';
import { t } from '@/strings';
import { Card, Icon, ItemList } from '@/ui';
import type { BoardRow } from '../board';
import { lateCount } from '../head';
import styles from '../routes/planner.module.css';

/** The danger tone of the page stands here once: one icon, beside the words that say it (D9). */
function LateIcon() {
  return (
    <span className={styles.lateIcon} aria-hidden="true">
      <Icon name="alert" size={20} />
    </span>
  );
}

/** The rows of the group, in the one row form – neutral, „Frist war So“ in words. */
function LateRows({
  rows,
  renderRow,
}: {
  rows: readonly BoardRow[];
  renderRow: (row: BoardRow) => ReactNode;
}) {
  return (
    <>
      <p className={styles.lateLine}>{t.planner.late.line}</p>
      <ItemList label={t.planner.late.title}>{rows.map((row) => renderRow(row))}</ItemList>
    </>
  );
}

/**
 * „Frist vorbei“ (planner hub R2, D7): money whose deadline has passed, on no day and in no day's sum. As a card
 * it is the first of the context column; no rows, no card.
 */
export function LateGroup({
  rows,
  renderRow,
}: {
  rows: readonly BoardRow[];
  renderRow: (row: BoardRow) => ReactNode;
}) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <Card className={styles.sheet} aria-labelledby={id} data-testid="planner-late">
      <div className={styles.lateHead}>
        <LateIcon />
        <h2 id={id} className={styles.lateTitle}>
          <span>{t.planner.late.title}</span>
          <span className={styles.lateCount}>{lateCount(rows)}</span>
        </h2>
      </div>
      <LateRows rows={rows} renderRow={renderRow} />
    </Card>
  );
}

/**
 * The same group where there is no column beside the sheet (phone, narrow window): one row above the day –
 * „Frist vorbei · 6 Rechnungen“ – that unfolds the group in place. Folded on arrival: the day stays the first
 * thing on the screen.
 */
export function LateRow({
  rows,
  renderRow,
}: {
  rows: readonly BoardRow[];
  renderRow: (row: BoardRow) => ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <Card className={`${styles.sheet} ${styles.lateFold}`} aria-labelledby={`${id}-head`}>
      <h2 className={styles.lateFoldHead}>
        <button
          type="button"
          id={`${id}-head`}
          className={styles.lateRow}
          data-testid="planner-late-row"
          aria-expanded={open}
          aria-controls={`${id}-rows`}
          onClick={() => setOpen((cur) => !cur)}
        >
          <LateIcon />
          <span className={styles.lateRowText}>{t.planner.late.row(lateCount(rows))}</span>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={20} />
        </button>
      </h2>
      <div id={`${id}-rows`} hidden={!open} data-testid="planner-late">
        {open ? <LateRows rows={rows} renderRow={renderRow} /> : null}
      </div>
    </Card>
  );
}
