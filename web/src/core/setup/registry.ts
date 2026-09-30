import { connectors } from '@/core/connectors/registry';
import { loadModuleStates } from '@/core/modules/activation';
import { allManifests } from '@/core/modules/registry';
import { getPlatform } from '@/core/platform';
import { allTools } from '@/core/tools/registry';
import { CORE_STEPS } from './steps';
import type { SetupCtx, SetupStepDef } from './types';

interface Source {
  id: string;
  setupSteps?: SetupStepDef[];
}

/** Step ids of a module/tool/connector must start with its own id (`todos.templates`). */
export function validateSetupSteps(sources: readonly Source[], core: readonly SetupStepDef[]) {
  const errors: string[] = [];
  const seen = new Set<string>();
  const check = (step: SetupStepDef, prefix?: string) => {
    if (seen.has(step.id)) errors.push(`setup step id "${step.id}" is used twice`);
    seen.add(step.id);
    if (prefix && !step.id.startsWith(`${prefix}.`))
      errors.push(`setup step "${step.id}" must start with "${prefix}."`);
    if (!Number.isInteger(step.since) || step.since < 1)
      errors.push(`setup step "${step.id}" needs a positive integer "since"`);
  };
  core.forEach((s) => check(s));
  for (const src of sources) src.setupSteps?.forEach((s) => check(s, src.id));
  return errors;
}

export function collectSetupSteps(
  sources: readonly Source[],
  core: readonly SetupStepDef[] = CORE_STEPS,
): SetupStepDef[] {
  const all = [...core, ...sources.flatMap((s) => s.setupSteps ?? [])];
  return all.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const allSetupSteps: readonly SetupStepDef[] = collectSetupSteps([
  ...allManifests,
  ...allTools,
  ...connectors,
]);

export async function buildSetupCtx(): Promise<SetupCtx> {
  const platform = getPlatform();
  return {
    modules: await loadModuleStates(),
    platform: platform.kind,
    isNative: platform.isNative,
  };
}

/** The steps that apply right now (`when`), in order. A throwing condition hides only its step. */
export async function applicableSteps(
  steps: readonly SetupStepDef[],
  ctx: SetupCtx,
): Promise<SetupStepDef[]> {
  const out: SetupStepDef[] = [];
  for (const step of steps) {
    try {
      if (!step.when || (await step.when(ctx))) out.push(step);
    } catch {
      // Ignore: a broken condition must not break the assistant.
    }
  }
  return out;
}

/** Ids of steps that `isDone` recognises as already done (e.g. a provider added in the settings). */
export async function detectDone(
  steps: readonly SetupStepDef[],
  ctx: SetupCtx,
): Promise<Set<string>> {
  const done = new Set<string>();
  for (const step of steps) {
    try {
      if (step.isDone && (await step.isDone(ctx))) done.add(step.id);
    } catch {
      // Not done as far as we can tell.
    }
  }
  return done;
}
