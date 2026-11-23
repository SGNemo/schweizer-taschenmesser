import { useState } from 'react';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Chip, Chips, DateField, Dialog } from '@/ui';
import styles from '../routes/todos.module.css';

/**
 * „In den Plan …“ (todos-plan-state): the day for one task or a selection – heute, morgen, a date, or „Noch ohne Tag“.
 * The page asks the planner through `plan.requested` (`requestManyIntoPlan`); the planner lays them, says so in its
 * toast and keeps the one undo. One tap on a chip acts.
 */
export function PlanDayDialog({
  open,
  title,
  day,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  /** Today ('YYYY-MM-DD'). */
  day: string;
  /** A day, or `null` for „Noch ohne Tag“. */
  onPick: (date: string | null) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const p = t.todos.plan;
  const pick = (d: string | null) => {
    onClose();
    onPick(d);
  };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= day;
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className={styles.planHint}>{p.hint}</p>
      <Chips label={p.days}>
        <Chip label={t.ui.datePresets.today} onClick={() => pick(day)} />
        <Chip label={p.tomorrow} onClick={() => pick(addDaysStr(day, 1))} />
        <Chip label={p.noDay} onClick={() => pick(null)} />
      </Chips>
      <form
        className={styles.planDate}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) pick(date);
        }}
      >
        <DateField
          label={p.date}
          value={date}
          min={day}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button type="submit" disabled={!valid}>
          {p.onDate}
        </Button>
      </form>
      <p className={styles.planHint}>{p.noDayHint}</p>
    </Dialog>
  );
}
