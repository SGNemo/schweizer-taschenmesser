import { type FormEvent, type Ref, useId } from 'react';
import { t } from '@/strings';
import { Button, Chip, TextField } from '@/ui';
import type { FieldKind } from '../fieldKind';
import styles from '../routes/planner.module.css';
import { KindAnnouncer, KindPreview } from './KindPreview';

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
  preview,
  onAsTask,
  previewAbove,
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
  /**
   * Kinds in the field (package 3): the sure reading of the line – the preview line K1 replaces the examples (never
   * both), Enter stores it; K3 / Alt+Enter = `onAsTask`.
   */
  preview?: FieldKind;
  onAsTask?: () => void;
  /** The phone's last row: the line stands above the field, never under the keyboard. */
  previewAbove?: boolean;
}) {
  const examples = Object.values(t.planner.add.examples);
  const errorId = useId();
  const kindId = useId();
  const line =
    preview && onAsTask ? <KindPreview reading={preview} onAsTask={onAsTask} id={kindId} /> : null;
  return (
    // The phone's last row draws the line above the field (CSS order) – in the DOM it stays after it, so Tab reaches
    // „Als Aufgabe eintragen“ after the field (A11Y).
    <div className={previewAbove ? styles.lineAbove : undefined}>
      <KindAnnouncer reading={preview} />
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
            onKeyDown={(e) => {
              // K3 from the keyboard: the line becomes a plain ToDo.
              if (e.key === 'Enter' && e.altKey && preview && onAsTask) {
                e.preventDefault();
                onAsTask();
              }
            }}
            readOnly={reading}
            // The message stands under the whole row (S09: „Eintragen“ lines up with the input, not with a line
            // under it), so the field points to it instead of using its own error line.
            aria-invalid={error || undefined}
            aria-describedby={
              [error ? errorId : '', line ? kindId : ''].filter(Boolean).join(' ') || undefined
            }
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
      {line}
      {withExamples && !line ? (
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
