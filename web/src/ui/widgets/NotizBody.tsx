import type { ReactNode } from 'react';
import { useWidgetSize, rowsFor } from './size';
import styles from './Bodies.module.css';

/**
 * The `notiz` widget shape (identity v3.1, F05): a sheet of paper with a serif title and the first lines (notes,
 * chat, the mail inbox). `mark` is the module's signature in small beside the title (a stamp, a bubble), `meta`
 * the context line at the foot ("vor 2 Std · 3 Seiten"). 2 / 3 / 5 lines by size.
 */
export function NotizBody({
  title,
  lines,
  meta,
  mark,
}: {
  title: string;
  lines: readonly string[];
  meta?: string;
  mark?: ReactNode;
}) {
  const size = useWidgetSize();
  const shown = lines.slice(0, rowsFor(size, [2, 3, 5]));
  return (
    <div className={styles.notiz} data-body="notiz">
      <p className={styles.notizTitle}>
        {mark ? (
          <span className={styles.notizMark} aria-hidden="true">
            {mark}
          </span>
        ) : null}
        <span>{title}</span>
      </p>
      {shown.length > 0 ? (
        <ul className={styles.notizLines}>
          {shown.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
      {meta ? <p className={styles.notizMeta}>{meta}</p> : null}
    </div>
  );
}
