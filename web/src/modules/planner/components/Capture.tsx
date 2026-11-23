import { type FormEvent, type Ref, useId } from 'react';
import { t } from '@/strings';
import { Button, Chip, TextField } from '@/ui';
import styles from '../routes/planner.module.css';

/**
 * The planner's one field (planner hub R1): a thing to enter, or a sentence the planner reads („Donnerstag frei“).
 * Three example chips under it fill the field and focus it; they never submit. The page owns the text and what is
 * done with it. States: empty (the button waits), reading (the local model reads: the field is read-only), error
 * (nothing was stored: the text is still there and the field says so).
 */
export function Capture({
  value,
  onChange,
  onSubmit,
  reading,
  error,
  focusOnOpen,
  labelHidden,
  examples: withExamples = true,
  formRef,
  onPastePlan,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  /** The local model reads the sentence: the field waits. */
  reading: boolean;
  /** The entry was not stored. */
  error?: boolean;
  /** Inside a dialog: the field takes the focus when the dialog opens (`data-autofocus`). */
  focusOnOpen?: boolean;
  /** The label is said by what surrounds the field (a dialog's title). */
  labelHidden?: boolean;
  /** `false`: the field without its example chips (the phone's last row; the plus's sheet carries them). */
  examples?: boolean;
  formRef?: Ref<HTMLFormElement>;
  /**
   * „Plan einfügen“ (use case „Tag kippt“): a pasted block of lines or JSON is a plan, not one entry – the page opens
   * its preview with the text instead of squeezing it into one line. True when it took the text.
   */
  onPastePlan?: (text: string) => boolean;
}) {
  const examples = Object.values(t.planner.add.examples);
  const errorId = useId();
  return (
    <div>
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
            labelHidden={labelHidden}
            placeholder={t.planner.add.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (onPastePlan?.(pasted)) e.preventDefault();
            }}
            readOnly={reading}
            // The message stands under the whole row (S09: „Eintragen“ lines up with the input, not with a line
            // under it), so the field points to it instead of using its own error line.
            aria-invalid={error || undefined}
            aria-describedby={error ? errorId : undefined}
            enterKeyHint="done"
            data-autofocus={focusOnOpen || undefined}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!value.trim() || reading}>
          {t.planner.add.submit}
        </Button>
      </form>
      {error ? (
        <p id={errorId} className={styles.addError} role="alert" data-testid="planner-add-error">
          {t.planner.add.error}
        </p>
      ) : null}
      {withExamples ? (
        <div className={styles.examples} role="group" aria-label={t.planner.add.examplesLead}>
          <span className={styles.examplesLead} aria-hidden="true">
            {t.planner.add.examplesLead}
          </span>
          {examples.map((example) => (
            <Chip
              key={example}
              label={example}
              onClick={() => {
                onChange(example);
                // The chip fills the field; the person reads, changes and sends it there.
                const form = typeof formRef === 'object' ? formRef?.current : undefined;
                form?.querySelector('input')?.focus({ preventScroll: true });
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
