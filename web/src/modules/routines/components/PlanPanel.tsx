/**
 * A routine's panel under its plan row (planner hub 2, package 5a; hand-off 05 „Expanded“): the steps of the turn due
 * now as tick lines in order – ticked ones stay in place, struck – each tick this module's own write with its own undo
 * toast; the foot carries the planner's „Los“ (`PlanPanelFoot`). A tick never ends the turn by itself: „Fertig“ in „Los“
 * or the row's tick does. The id is the row's `<routine>:<due day>`: a turn finished elsewhere reads as gone.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PanelDefaultBody,
  PanelGone,
  PanelLoading,
  PlanPanelFoot,
} from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Checkbox, PanelLine, PanelLines } from '@/ui';
import { doneSteps, stepsOf } from '../logic';
import { setTurnStep, split } from '../plannable';
import { routineRepo } from '../repo';

export default function RoutinePlanPanel({ id, compact }: PlanPanelProps) {
  const { id: routineId, due } = split(id);
  const routine = useLiveQuery(async () => (await routineRepo.get(routineId)) ?? null, [routineId]);
  if (routine === undefined) return <PanelLoading />;
  if (routine === null || routine.dueDate !== due) return <PanelGone />;
  const steps = stepsOf(routine);
  const done = doneSteps(routine);
  if (compact)
    return (
      <PanelLines>
        <PanelLine>{routine.name}</PanelLine>
      </PanelLines>
    );
  const tick = (stepId: string, text: string, on: boolean) => {
    const word = on ? t.routines.run.stepTicked(text) : t.routines.run.stepReopened(text);
    void undoableWithToast(
      word,
      word,
      () => setTurnStep(id, stepId, on),
      () => setTurnStep(id, stepId, !on),
    );
  };
  return (
    <>
      {steps.length === 0 ? (
        <PanelDefaultBody />
      ) : (
        <PanelLines label={t.routines.run.steps}>
          {steps.map((s) => (
            <PanelLine
              key={s.id}
              done={done.has(s.id)}
              tick={
                <Checkbox
                  tone="neutral"
                  label={t.planner.panel.tick(s.text)}
                  labelHidden
                  checked={done.has(s.id)}
                  onChange={(e) => tick(s.id, s.text, e.target.checked)}
                />
              }
            >
              {s.text}
            </PanelLine>
          ))}
        </PanelLines>
      )}
      <PlanPanelFoot />
    </>
  );
}
