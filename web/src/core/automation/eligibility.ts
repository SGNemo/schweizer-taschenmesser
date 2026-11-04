/** Which modules a rule may read from or write to. The vault is never one of them. */
import type { ModuleManifest } from '@/core/modules/types';
import { EXCLUDED_MODULES } from './types';

export const isExcluded = (moduleId: string): boolean => EXCLUDED_MODULES.includes(moduleId);

/** Targets: enabled, with an `aiSchema` (the contract rules write through), never excluded. */
export const writableModules = (manifests: readonly ModuleManifest[]): ModuleManifest[] =>
  manifests.filter((m) => !isExcluded(m.id) && m.aiSchema !== undefined);
