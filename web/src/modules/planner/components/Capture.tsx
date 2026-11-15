import { type FormEvent, type ReactNode, type Ref, useId } from 'react';
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
  const hintId = useId();
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
          {/* S09 (UI round 6): the hint sits under the whole row, not inside the field, so „Eintragen“ and ⋯ line up
              with the input instead of with the hint's baseline. The prop replaces TextField's own description: an
              `error` here would have to be appended to `hintId`. */}
          <TextField
            label={t.planner.add.label}
            placeholder={t.planner.add.placeholder}
            aria-describedby={hintId}
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
      <p id={hintId} className={styles.addHint}>
        {t.planner.add.hint}
      </p>
    </>
  );
}
