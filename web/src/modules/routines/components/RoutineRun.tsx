import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, FormActions } from '@/ui';
import { markDone } from '../actions';
import { allStepsDone, doneSteps, stepsOf, toggleStepPatch, type StoredRoutine } from '../logic';
import { routineRepo } from '../repo';
import styles from './RoutineRun.module.css';

/**
 * „Los“: the steps of one routine, ticked one by one. A tick is stored at once (closing keeps it, another device
 * sees it); the last tick is „Erledigt“ for the whole routine, with „Rückgängig“ in the toast. Nothing counts days
 * or runs: the line says only how many steps of this turn are ticked.
 */
export function RoutineRun({
  id,
  onClose,
  onEdit,
}: {
  /** The routine to go through; null = closed. */
  id: string | null;
  onClose: () => void;
  onEdit: (r: StoredRoutine) => void;
}) {
  const routine = useLiveQuery(async () => (id ? routineRepo.get(id) : undefined), [id]);
  const r = routine && routine.id === id && !routine.deletedAt ? routine : undefined;
  return (
    <Dialog open={id !== null && !!r} onClose={onClose} title={r?.name ?? ''}>
      {r ? <Steps r={r} onClose={onClose} onEdit={onEdit} /> : null}
    </Dialog>
  );
}

function Steps({
  r,
  onClose,
  onEdit,
}: {
  r: StoredRoutine;
  onClose: () => void;
  onEdit: (r: StoredRoutine) => void;
}) {
  const steps = stepsOf(r);
  const stored = doneSteps(r);
  // A tick shows at once, before the stored row comes back; an entry the stored row agrees with is dropped.
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const pending = Object.entries(shown).filter(([id, on]) => stored.has(id) !== on);
  if (pending.length !== Object.keys(shown).length) setShown(Object.fromEntries(pending));
  const done = new Set(stored);
  for (const [id, on] of pending) {
    if (on) done.add(id);
    else done.delete(id);
  }

  async function toggle(stepId: string, checked: boolean) {
    setShown((s) => ({ ...s, [stepId]: checked }));
    const patch = toggleStepPatch(
      { ...r, progress: { day: r.dueDate, done: [...done] } },
      stepId,
      checked,
    );
    await routineRepo.update(r.id, patch);
    const next = { ...r, ...patch };
    // `done` already holds the ticks shown so far, so quick ticks in a row are not lost.
    if (checked && allStepsDone(next)) {
      onClose();
      await markDone(next);
    }
  }

  async function finish() {
    onClose();
    await markDone(r);
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.progress} role="status" data-testid="routine-run-progress">
        {t.routines.run.progress(done.size, steps.length)}
      </p>
      <fieldset className={styles.steps}>
        <legend className="sr-only">{t.routines.run.steps}</legend>
        {steps.map((s, i) => (
          <Checkbox
            key={s.id}
            label={s.text}
            checked={done.has(s.id)}
            // The first open step has the focus: Space ticks it, Tab goes on.
            data-autofocus={
              !done.has(s.id) && steps.findIndex((x) => !done.has(x.id)) === i ? true : undefined
            }
            onChange={(e) => void toggle(s.id, e.target.checked)}
          />
        ))}
      </fieldset>
      <FormActions
        start={
          <Button variant="ghost" onClick={() => onEdit(r)}>
            {t.routines.run.edit}
          </Button>
        }
      >
        <Button onClick={onClose}>{t.routines.run.later}</Button>
        <Button variant="primary" onClick={() => void finish()}>
          {t.routines.run.allDone}
        </Button>
      </FormActions>
    </div>
  );
}
