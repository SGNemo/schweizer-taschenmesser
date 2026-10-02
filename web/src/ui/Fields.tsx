import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { humanDateHint } from '@/core/time/dates';
import { Icon } from './icons';
import styles from './Fields.module.css';

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
  /** Keep the label for screen readers only (inline "add" forms with a clear placeholder). */
  labelHidden?: boolean;
}

/** Label above, control, then hint and error sentence; wires `aria-describedby` for the control. */
function Field({
  id,
  label,
  labelHidden,
  hint,
  error,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : styles.label}>
        {label}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;

export function TextField({
  label,
  hint,
  error,
  labelHidden,
  className,
  ref,
  ...rest
}: BaseProps & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <Field id={id} label={label} labelHidden={labelHidden} hint={hint} error={error}>
      <input
        id={id}
        ref={ref}
        className={[styles.control, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </Field>
  );
}

/** A date input that says what the date means ("Montag, in 6 Tagen") unless a `hint` is given. */
export function DateField({
  hint,
  value,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> &
  BaseProps & { ref?: Ref<HTMLInputElement> }) {
  const text = typeof value === 'string' ? value : '';
  return (
    <TextField
      {...rest}
      type="date"
      value={value}
      hint={hint ?? (/^\d{4}-\d{2}-\d{2}$/.test(text) ? humanDateHint(text) : undefined)}
    />
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={[styles.control, styles.area, className].filter(Boolean).join(' ')}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </Field>
  );
}

/** Native select (best keyboard and mobile behaviour) with the shared look and a chevron. */
export function SelectField({
  label,
  hint,
  error,
  labelHidden,
  children,
  className,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const id = useId();
  return (
    <Field id={id} label={label} labelHidden={labelHidden} hint={hint} error={error}>
      <span className={styles.selectWrap}>
        <select
          id={id}
          className={[styles.control, styles.select, className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...rest}
        >
          {children}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="chevronDown" size={18} />
        </span>
      </span>
    </Field>
  );
}

export function Checkbox({
  label,
  labelHidden,
  ...rest
}: {
  label: ReactNode;
  /** Label for screen readers only (a checkbox inside a row). */
  labelHidden?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={styles.check}>
      <input type="checkbox" {...rest} />
      <span className={labelHidden ? 'sr-only' : undefined}>{label}</span>
    </label>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={styles.switch}>
      <span>
        <span id={id} className={styles.label}>
          {label}
        </span>
        {hint ? <span className={styles.hint}> · {hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        className={styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
