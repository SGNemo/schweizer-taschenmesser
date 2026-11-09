import { useId, useState } from 'react';
import { tDeadline } from '@/strings.deadline';
import { SelectField, TextField } from '@/ui';
import {
  daysToNotice,
  noticeFromInput,
  noticeMonthsOf,
  NOTICE_UNITS,
  type NoticeUnit,
} from './notice';
import styles from './NoticeField.module.css';

/** Without a stored month count a period is shown in weeks or days, never as "months" (which the date logic would not apply). */
function legacyDisplay(days: number): { amount: number; unit: NoticeUnit } {
  const d = daysToNotice(days);
  return d.unit === 'months' ? { amount: days, unit: 'days' } : d;
}

/** Notice period entered as an amount plus days/weeks/months; reports whole days (or undefined = none). */
export function NoticeField({
  days,
  months,
  onChange,
  max,
  label,
}: {
  /** The stored value when the form opens; later changes come from this field itself. */
  days: number | undefined;
  /** The stored month count, if the period was entered in months. */
  months?: number;
  /** `months` is set only for a whole number of calendar months. */
  onChange: (days: number | undefined, months?: number) => void;
  max: number;
  label?: string;
}) {
  const s = tDeadline.use();
  const hintId = useId();
  const storedMonths = days === undefined ? undefined : noticeMonthsOf({ days, months });
  const initial =
    days === undefined
      ? undefined
      : storedMonths !== undefined
        ? { amount: storedMonths, unit: 'months' as const }
        : legacyDisplay(days);
  const [text, setText] = useState(initial ? String(initial.amount) : '');
  const [unit, setUnit] = useState<NoticeUnit>(initial?.unit ?? 'days');
  const emit = (t: string, u: NoticeUnit) => {
    const v = noticeFromInput(t, u, max);
    onChange(v?.days, v?.months);
  };
  // The hint belongs to amount and unit together: it sits under the row, so both fields keep one height (U27b).
  return (
    <div className={styles.field}>
      <div className={styles.row} data-notice-row>
        <div className={styles.amount}>
          <TextField
            label={label ?? s.noticeLabel}
            type="number"
            inputMode="numeric"
            min={0}
            value={text}
            aria-describedby={hintId}
            onChange={(e) => {
              setText(e.target.value);
              emit(e.target.value, unit);
            }}
          />
        </div>
        <div className={styles.unit}>
          <SelectField
            label={s.unit}
            value={unit}
            onChange={(e) => {
              const u = e.target.value as NoticeUnit;
              setUnit(u);
              emit(text, u);
            }}
          >
            {NOTICE_UNITS.map((u) => (
              <option key={u} value={u}>
                {s.units[u]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <p id={hintId} className={styles.hint}>
        {s.hint}
      </p>
    </div>
  );
}
