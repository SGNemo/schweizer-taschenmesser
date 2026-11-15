import type { FormEvent, ReactNode, Ref } from 'react';
import { t } from '@/strings';
import { Button, TextField } from '@/ui';
import styles from '../routes/planner.module.css';

/**
 * The planner's one field: a thing to enter, or a sentence the planner reads („Donnerstag frei“). The page owns
 * the text and what is done with it; `children` follow the submit button in the row.
 */
export function Capture({
  value,
  onChange,
  onSubmit,
  reading,
  formRef,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  /** The local model reads the sentence: the field waits. */
  reading: boolean;
  formRef?: Ref<HTMLFormElement>;
  children?: ReactNode;
}) {
  return (
    <>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className={styles.add}
        data-keep-visible
        aria-busy={reading || undefined}
      >
        <div className={styles.grow}>
          <TextField
            label={t.planner.add.label}
            placeholder={t.planner.add.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={reading}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!value.trim() || reading}>
          {t.planner.add.submit}
        </Button>
        {children}
      </form>
    </>
  );
}
