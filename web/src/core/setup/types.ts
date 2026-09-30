/**
 * Setup assistant: step contract. Steps are contributed by the core (`core/setup/steps`), by
 * module manifests (`setupSteps`), tool manifests and connector definitions. A step is never
 * "required": nothing in the app may depend on it having been done.
 */
import type { ComponentType } from 'react';
import type { PlatformKind } from '@/core/platform/types';

/** Bump when a release adds steps; steps with `since` above the stored version show up as new. */
export const SETUP_VERSION = 1;

export interface SetupCtx {
  /** Enabled state per module id (explicit row, else `defaultEnabled`). */
  modules: Readonly<Record<string, boolean>>;
  platform: PlatformKind;
  isNative: boolean;
}

export interface SetupStepProps {
  ctx: SetupCtx;
  /**
   * Registers what "Weiter" writes. A step keeps its draft in component state and hands the write
   * here; the wizard runs it, marks the step done only when it succeeded, and drops it on cancel.
   * Pass `null` to unregister (nothing to write).
   */
  registerCommit(commit: (() => Promise<void>) | null): void;
}

export interface SetupStepDef {
  /** Unique. Module/tool/connector steps must start with `<id>.`. */
  id: string;
  title: string;
  description: string;
  /** Lower = earlier. Core steps use multiples of 10. */
  order: number;
  /** `SETUP_VERSION` at which the step was introduced. */
  since: number;
  /** Only shown when this returns true (e.g. module active, native only). */
  when?(ctx: SetupCtx): boolean | Promise<boolean>;
  /** Detects a step that was completed elsewhere (e.g. a provider added in the settings). */
  isDone?(ctx: SetupCtx): Promise<boolean>;
  component: () => Promise<{ default: ComponentType<SetupStepProps> }>;
}
