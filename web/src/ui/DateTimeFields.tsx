import { useId, useRef, useState } from 'react';
import { humanDateHint, today } from '@/core/time/dates';
import { tFields } from '@/strings.fields';
import { IconButton } from './Button';
import { Icon } from './icons';
import {
  datePlaceholder,
  formatDateInput,
  formatTimeInput,
  parseDateInput,
  parseTimeInput,
} from './dateInput';
import fieldStyles from './Fields.module.css';
import styles from './DateTimeFields.module.css';

interface Props {
  label: string;
  /** `YYYY-MM-DD` (`DayField`) or `HH:mm` (`TimeField`); empty = no value. */
  value: string;
  /** Called with the stored form once the text is a date or time, and with `''` when the field was emptied. */
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  labelHidden?: boolean;
  'data-autofocus'?: boolean;
}

/** Shared body: a text field that shows `format(value)` and reports `parse(text)`. */
function ParsedField({
  label,
  value,
  onChange,
  hint,
  required,
  labelHidden,
  format,
  parse,
  placeholder,
  invalid,
  inputMode,
  picker,
  ...rest
}: Props & {
  format: (value: string) => string;
  parse: (text: string) => string | undefined;
  placeholder: string;
  invalid: string;
  inputMode: 'numeric' | 'text';
  /** Gets the id of the field's label, to say which field a button beside it belongs to. */
  picker?: (labelId: string) => React.ReactNode;
}) {
  const id = useId();
  // While someone types, the field shows their text; otherwise the stored value in the region's form.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const text = draft ?? format(value);
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={fieldStyles.field}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={labelHidden ? 'sr-only' : fieldStyles.label}
      >
        {label}
      </label>
      <div className={styles.row}>
        <input
          {...rest}
          id={id}
          className={fieldStyles.control}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            setError(false);
            const parsed = parse(next);
            if (parsed) onChange(parsed);
            else if (next.trim() === '' && !required) onChange('');
          }}
          onBlur={() => {
            if (draft === null) return;
            const empty = draft.trim() === '';
            if (parse(draft) || (empty && !required)) setDraft(null);
            else if (empty) {
              // A required field never stays empty behind the user's back: the last value returns.
              setDraft(null);
            } else setError(true);
          }}
        />
        {picker?.(`${id}-label`)}
      </div>
      {hint ? (
        <span id={`${id}-hint`} className={fieldStyles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className={fieldStyles.error} role="alert">
          {invalid}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A date field in the app's own format (UI audit 2026-11, B10): the text follows the format setting
 * ("31.12.2026", "12/31/2026"), not the system's locale as a native date input does. It reads what people type
 * ("3.9.", "03092026", the ISO form), and the button opens the system's calendar. The value is `YYYY-MM-DD`.
 * Without a `hint` it says what the date means ("Montag, in 6 Tagen").
 */
export function DayField({ hint, ...props }: Props) {
  const tx = tFields.use();
  const native = useRef<HTMLInputElement>(null);
  return (
    <ParsedField
      {...props}
      hint={hint ?? (props.value ? humanDateHint(props.value) : undefined)}
      format={formatDateInput}
      parse={parseDateInput}
      placeholder={datePlaceholder(tx.letters)}
      invalid={`${tx.invalidDate} ${formatDateInput(today())}`}
      inputMode="numeric"
      picker={(labelId) => (
        <span className={styles.picker}>
          {/* Named by what it does and described by the field's label: `getByLabel('Datum')` stays the field. */}
          <IconButton
            label={tx.pickDate}
            aria-describedby={labelId}
            onClick={() => {
              const el = native.current;
              if (!el) return;
              if (typeof el.showPicker === 'function') el.showPicker();
              else el.focus();
            }}
          >
            <Icon name="calendar" />
          </IconButton>
          {/* The system's calendar, opened by the button; never in the tab order, never read out. */}
          <input
            ref={native}
            className={styles.native}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={props.value}
            onChange={(e) => {
              if (e.target.value) props.onChange(e.target.value);
            }}
          />
        </span>
      )}
    />
  );
}

/** A time field in the app's own format ("14:30", "2:30 PM"); reads "9", "930", "9.30", "9:30 pm". The value is `HH:mm`. */
export function TimeField(props: Props) {
  const tx = tFields.use();
  return (
    <ParsedField
      {...props}
      format={formatTimeInput}
      parse={parseTimeInput}
      placeholder={formatTimeInput('09:30')}
      invalid={`${tx.invalidTime} ${formatTimeInput('09:30')}`}
      inputMode="text"
    />
  );
}
