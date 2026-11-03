import styles from './HeroFigure.module.css';

/**
 * The big number of a module head: label above, value, one context line below ("a context line for every number").
 * `type` follows `identity.type`: `thin` = Nothing-style light numerals, `mono` = tabular mono for times.
 */
export function HeroFigure({
  label,
  value,
  unit,
  detail,
  type = 'sans',
  testId,
}: {
  label?: string;
  value: string;
  unit?: string;
  detail?: string;
  type?: 'sans' | 'thin' | 'mono' | 'serif';
  testId?: string;
}) {
  return (
    <div className={styles.figure} data-type={type}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.value} data-testid={testId}>
        {value}
        {unit ? <small className={styles.unit}>{unit}</small> : null}
      </span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
    </div>
  );
}
