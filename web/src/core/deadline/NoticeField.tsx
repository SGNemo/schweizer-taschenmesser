import { useState } from 'react';
import { tDeadline } from '@/strings.deadline';
import { SelectField, TextField } from '@/ui';
import { daysToNotice, noticeToDays, NOTICE_UNITS, type NoticeUnit } from './notice';
import styles from './NoticeField.module.css';

/** Notice period entered as an amount plus days/weeks/months; reports whole days (or undefined = none). */
export function NoticeField({
  days,
  onChange,
  max,
  label,
}: {
  /** The stored value when the form opens; later changes come from this field itself. */
  days: number | undefined;
  onChange: (days: number | undefined) => void;
  max: number;
  label?: string;
}) {
  const s = tDeadline.use();
  const initial = days === undefined ? undefined : daysToNotice(days);
  const [text, setText] = useState(initial ? String(initial.amount) : '');
  const [unit, setUnit] = useState<NoticeUnit>(initial?.unit ?? 'days');
  const emit = (t: string, u: NoticeUnit) => onChange(noticeToDays(t, u, max));
  return (
    <div className={styles.row}>
      <div className={styles.amount}>
        <TextField
          label={label ?? s.noticeLabel}
          type="number"
          inputMode="numeric"
          min={0}
          value={text}
          hint={s.hint}
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
  );
}
