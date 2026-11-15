import { dayName, partWord } from '@/core/plan/explain';
import { t } from '@/strings';
import { ItemRow, type RowMenuItem } from '@/ui';
import { dueWas, type BoardRow } from '../board';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

/** „Teil 1/2“ for the eye, „Teil 1 von 2“ for the screen reader. */
export function Part({ k, of }: { k: number; of: number }) {
  return (
    <>
      <span className={styles.part} aria-hidden="true">
        {` · ${t.planner.row.part(k + 1, of)}`}
      </span>
      <span className="sr-only">{` ${t.planner.row.partAria(k + 1, of)}`}</span>
    </>
  );
}

/** One planned thing of a day: tick, title, meta line, ⋯ menu and the phone's swipes. */
export function ThingRow({
  row,
  reason,
  whyOpen,
  dueClock,
  menu,
  onDone,
  onLater,
}: {
  row: BoardRow;
  /** „Warum hier?“ in words; shown only while `whyOpen`. */
  reason: string;
  whyOpen: boolean;
  /** Now (epoch ms, read once a minute): „Frist So 18:00“ turns into „Frist war So 18:00“ once the hour has passed. */
  dueClock: number;
  menu: RowMenuItem[];
  /** The source takes a tick (ToDo, routine): one tap; undefined for an invoice or a cancellation. */
  onDone?: () => void;
  onLater?: () => void;
}) {
  return (
    <ItemRow
      title={
        <span title={reason}>
          {row.title}
          {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
        </span>
      }
      titleFull
      // The minutes lead the meta line, the deadline follows, the reason only while „Warum hier?“ is on.
      meta={
        <span>
          <span className={styles.minutes}>
            {row.approx ? t.planner.row.approx(compact(row.minutes)) : compact(row.minutes)}
          </span>
          {/* The part as plain text, only when set (package 4b; no colour carries it). */}
          {row.item?.part ? <span>{` · ${partWord(row.item.part)}`}</span> : null}
          {row.hardDue
            ? (() => {
                const when = row.hardDueTime
                  ? `${dayName(row.hardDue)} ${row.hardDueTime}`
                  : dayName(row.hardDue);
                const was = dueWas(row, dueClock);
                return (
                  <span className={was ? styles.dueWas : undefined}>
                    {` · ${was ? t.planner.row.dueWas(when) : t.planner.row.due(when)}`}
                  </span>
                );
              })()
            : null}
          {row.entry?.detail ? <span>{` · ${row.entry.detail}`}</span> : null}
          {whyOpen ? <span className={styles.reason}>{reason}</span> : null}
        </span>
      }
      lead={
        onDone ? (
          <input
            type="checkbox"
            className={styles.check}
            aria-label={row.title}
            data-row-tick
            checked={false}
            onChange={onDone}
          />
        ) : undefined
      }
      menu={menu}
      menuLabel={t.planner.row.menu(row.title)}
      onSwipeRight={onDone}
      swipeRightLabel={t.planner.row.done}
      onSwipeLeft={onLater}
      swipeLeftLabel={t.planner.row.later}
    />
  );
}
