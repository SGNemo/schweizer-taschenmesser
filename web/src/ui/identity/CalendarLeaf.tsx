import styles from './CalendarLeaf.module.css';

/** Calendar leaf: month on a coloured strip, big day number, weekday. Text only; the strip takes the module hue. */
export function CalendarLeaf({
  month,
  day,
  weekday,
  size = 'md',
}: {
  month: string;
  day: string;
  weekday?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className={`${styles.leaf} ${styles[size]}`} data-testid="calendar-leaf">
      <span className={styles.month}>{month}</span>
      <span className={styles.day}>{day}</span>
      {weekday && size !== 'sm' ? <span className={styles.weekday}>{weekday}</span> : null}
    </div>
  );
}
