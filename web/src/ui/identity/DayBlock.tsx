import styles from './DayBlock.module.css';

/**
 * Today as the head of a time module (`zeit` variant): the day number large, month, weekday and calendar week beside it.
 * Real text, so a screen reader reads the date; the numeral is tabular and takes the head's typography.
 */
export function DayBlock({
  day,
  month,
  weekday,
  week,
}: {
  day: string;
  month: string;
  weekday: string;
  week: string;
}) {
  return (
    <div className={styles.block} data-testid="day-block">
      <span className={styles.day}>{day}</span>
      <span className={styles.line}>
        <span>{month}</span>
        <span>
          {weekday} · {week}
        </span>
      </span>
    </div>
  );
}
