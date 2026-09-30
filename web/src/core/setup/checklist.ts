import { useEffect, useState } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { applicableSteps, allSetupSteps, buildSetupCtx, detectDone } from './registry';
import { newSteps, stepProgress, type SetupState, type StepProgress } from './state';
import { useSetupState } from './hooks';
import type { SetupStepDef } from './types';

export interface ChecklistItem {
  id: string;
  title: string;
  progress: StepProgress;
  /** Added by a later release than the one the user last went through. */
  isNew: boolean;
}

export interface Checklist {
  total: number;
  done: number;
  /** Open, skipped and new steps – what is left to do. */
  open: ChecklistItem[];
}

/** Pure: what the dashboard card shows. Steps completed elsewhere (`autoDone`) count as done. */
export function buildChecklist(
  steps: readonly Pick<SetupStepDef, 'id' | 'title' | 'since'>[],
  state: SetupState,
  autoDone: ReadonlySet<string> = new Set(),
): Checklist {
  const fresh = new Set(newSteps(steps, state).map((s) => s.id));
  const items = steps.map((s) => ({
    id: s.id,
    title: s.title,
    progress: stepProgress(state, s.id, autoDone.has(s.id)),
    isNew: fresh.has(s.id),
  }));
  return {
    total: items.length,
    done: items.filter((i) => i.progress === 'done').length,
    open: items.filter((i) => i.progress !== 'done'),
  };
}

/** Whether the dashboard card is shown at all. */
export function showChecklist(state: SetupState, list: Checklist): boolean {
  if (state.checklistHidden || state.status === 'notStarted') return false;
  return list.open.length > 0;
}

/** Live checklist; `undefined` until the applicable steps are known. */
export function useChecklist(steps: readonly SetupStepDef[] = allSetupSteps) {
  const state = useSetupState();
  const modules = useModuleStates();
  const [list, setList] = useState<Checklist | undefined>();

  useEffect(() => {
    if (!state || !modules) return;
    let live = true;
    void (async () => {
      const ctx = { ...(await buildSetupCtx()), modules };
      const applicable = await applicableSteps(steps, ctx);
      const done = await detectDone(applicable, ctx);
      if (live) setList(buildChecklist(applicable, state, done));
    })();
    return () => {
      live = false;
    };
  }, [state, modules, steps]);

  return state && list ? { state, list } : undefined;
}
