import { SensitiveValue } from '../SensitiveValue';
import styles from './HeroFigure.module.css';

/**
 * The big number of a module head: label above, value, one context line below ("a context line for every number").
 * `type` follows `identity.type`: `thin` = Nothing-style light numerals, `mono` = tabular mono for times.
 * `sensitive` marks a money figure: with "Werte ausblenden" on, the value is a placeholder until it is tapped
 * (`SensitiveValue`), in the head as in the widgets; the context line stays (it must not carry an amount then).
 */
export function HeroFigure({
  label,
  value,
  unit,
  detail,
  type = 'sans',
  sensitive = false,
  testId,
}: {
  label?: string;
  value: string;
  unit?: string;
  detail?: string;
  type?: 'sans' | 'thin' | 'mono' | 'serif';
  sensitive?: boolean;
  testId?: string;
}) {
  return (
    <div className={styles.figure} data-type={type}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.value} data-testid={testId}>
        {sensitive ? (
          <SensitiveValue className={styles.mask}>
            {value}
            {unit ? <small className={styles.unit}>{unit}</small> : null}
          </SensitiveValue>
        ) : (
          <>
            {value}
            {unit ? <small className={styles.unit}>{unit}</small> : null}
          </>
        )}
      </span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
    </div>
  );
}
