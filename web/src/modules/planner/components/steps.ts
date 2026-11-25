/**
 * A thing with steps in the plan (planner hub 2, package 5a; hand-off 05 „Closed row“, „Expanded“): its meta B1, the
 * way into „Los“ and what the panel's foot carries besides the module's own actions.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import { t } from '@/strings';
import type { RowMenuItem } from '@/ui';
import { planFocusPath } from '../focus';
import { canSaveAsRoutine, saveAsRoutine } from '../routineSave';

/** „Los“: the focus page in step mode. */
export const stepsPath = (unitId: string): string => `${planFocusPath(unitId)}?step=1`;

/** A list keeps its own word in the title („Einkaufen · 7 Dinge“): only „2 von 7“ once something is ticked. */
const LIST_KINDS = new Set(['shopping', 'packing']);

/** B1: „5 Schritte“, once one is done „1 von 5“ (k = done steps); a list only its „k von n“. No bar, no percent. */
export function stepsFact(
  entry: Pick<PlannableEntry, 'steps' | 'kind'> | undefined,
): string | undefined {
  const steps = entry?.steps;
  if (!steps?.length) return undefined;
  const k = steps.filter((s) => s.done).length;
  if (k > 0) return t.planner.steps.progress(k, steps.length);
  return LIST_KINDS.has(entry!.kind) ? undefined : t.planner.steps.count(steps.length);
}

/** Has the thing a step left to do? Only then „Los“ is offered. */
export const hasOpenSteps = (entry: Pick<PlannableEntry, 'steps'> | undefined): boolean =>
  !!entry?.steps?.some((s) => !s.done);

/** What the panel's foot carries for a thing with open steps: „Los“ and the ⋯ entries (stable between renders). */
export function useStepsFoot(
  entry: PlannableEntry | undefined,
  unitId: string,
  menu: RowMenuItem[],
): { go: () => void; menu: RowMenuItem[] } | undefined {
  const navigate = useNavigate();
  const open = hasOpenSteps(entry);
  const menuKey = menu.map((m) => m.id).join('|');
  return useMemo(
    () => (open ? { go: () => void navigate(stepsPath(unitId)), menu } : undefined),
    // The entries are rebuilt each render; their ids say when they changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, unitId, navigate, menuKey],
  );
}

/** The foot's ⋯ (package 5a): „Als Routine speichern“ while it may be offered (`canSaveAsRoutine`). */
export function useRoutineMenu(entry: PlannableEntry | undefined): RowMenuItem[] {
  const navigate = useNavigate();
  const key = entry
    ? `${entry.moduleId}:${entry.id}:${entry.link ? 1 : 0}:${entry.steps?.length ?? 0}`
    : '';
  const can = useLiveQuery(
    async () => (entry ? canSaveAsRoutine(entry) : false),
    [key],
  );
  if (!can || !entry) return [];
  return [
    {
      id: 'asRoutine',
      label: t.planner.steps.asRoutine,
      onSelect: () => void saveAsRoutine(entry, {}, (path) => void navigate(path)),
    },
  ];
}
