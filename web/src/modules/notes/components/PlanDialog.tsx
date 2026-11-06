import { useState, type FormEvent } from 'react';
import { t } from '@/strings';
import { Button, Chip, Chips, DateField, Dialog, SelectField, TextField } from '@/ui';
import styles from './Dialogs.module.css';

/** Duration steps of the focus guideline (docs/design/FOCUS-GUIDELINES.md), plus a free entry. */
export const PLAN_STEPS = [5, 15, 30, 60] as const;
const MAX_MIN = 600;

export interface PlanRequest {
  durationMin: number;
  priority: 0 | 1 | 2 | 3;
  /** A deadline: the planner keeps it as hard. */
  due?: string;
}

/**
 * The small sheet of „In den Plan“: how long (5/15/30/60 or free), how important, optionally by when. The
 * page itself only emits `plan.requested`; the planner does the rest and says where it landed.
 */
export function PlanDialog({
  title,
  onSubmit,
  onClose,
}: {
  /** The page's title (the dialog is shown while it is set). */
  title: string | null;
  onSubmit: (req: PlanRequest) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={title !== null} onClose={onClose} title={t.notes.plan.action}>
      {title !== null ? <PlanForm key={title} onSubmit={onSubmit} /> : null}
    </Dialog>
  );
}

function PlanForm({ onSubmit }: { onSubmit: (req: PlanRequest) => void }) {
  const [step, setStep] = useState<number | undefined>(30);
  const [free, setFree] = useState('');
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(0);
  const [due, setDue] = useState('');
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = free.trim() ? Math.round(Number(free.replace(',', '.'))) : step;
    if (!minutes || !Number.isFinite(minutes) || minutes < 1 || minutes > MAX_MIN) {
      setError(true);
      return;
    }
    onSubmit({ durationMin: minutes, priority, ...(due ? { due } : {}) });
  };
  return (
    <form className={styles.history} onSubmit={submit}>
      <Chips label={t.notes.plan.duration}>
        {PLAN_STEPS.map((n) => (
          <Chip
            key={n}
            label={t.notes.plan.minutes(n)}
            selected={!free.trim() && step === n}
            onClick={() => {
              setStep(n);
              setFree('');
              setError(false);
            }}
          />
        ))}
      </Chips>
      <TextField
        label={t.notes.plan.other}
        inputMode="numeric"
        value={free}
        error={error ? t.notes.plan.invalid : undefined}
        onChange={(e) => {
          setFree(e.target.value);
          setError(false);
        }}
      />
      <SelectField
        label={t.notes.plan.priority}
        value={String(priority)}
        onChange={(e) => setPriority(Number(e.target.value) as 0 | 1 | 2 | 3)}
      >
        {t.notes.plan.prio.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </SelectField>
      <DateField
        label={t.notes.plan.due}
        hint={t.notes.plan.dueHelp}
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <Button type="submit" variant="primary" data-autofocus>
        {t.notes.plan.action}
      </Button>
    </form>
  );
}
