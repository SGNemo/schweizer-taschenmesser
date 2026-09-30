import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Fields.module.css';

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
  /** Keep the label for screen readers only (inline "add" forms with a clear placeholder). */
  labelHidden?: boolean;
}

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
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : styles.label}>
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className={[styles.control, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
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

export function TextArea({
  label,
  hint,
  ...rest
}: Omit<BaseProps, 'error'> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea id={id} className={`${styles.control} ${styles.area}`} rows={3} {...rest} />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  children,
  ...rest
}: Omit<BaseProps, 'error'> & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} className={styles.control} {...rest}>
        {children}
      </select>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

export function Checkbox({
  label,
  ...rest
}: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={styles.check}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
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
