/**
 * What the assistant may see. A module without `aiSchema` does not exist for the AI: it is not in
 * the prompt, the tools, the full-text search or the executor. This is the single filter; the AI
 * entry points (`ask`, `searchEntries`, the prompt builders) all go through it, so a module that
 * holds secrets (`accounts`) is excluded by leaving the schema out – nothing else to remember.
 */
import type { ModuleAiSchema, ModuleManifest } from '@/core/modules/types';

export type AiModule = ModuleManifest & { aiSchema: ModuleAiSchema };

export const hasAiSchema = (m: ModuleManifest): m is AiModule => m.aiSchema !== undefined;

export const aiModules = (manifests: readonly ModuleManifest[]): AiModule[] =>
  manifests.filter(hasAiSchema);
