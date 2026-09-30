/**
 * The wizard's view of a module's importers: what the manifest declares plus the generic JSON
 * import, which every data-API module gets without any module code.
 */
import type { ImporterMeta, ImporterRuntime } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { createJsonRuntime, JSON_IMPORTER_ID, jsonImporterMeta } from './importer';
import { isDataApiModule } from './scope';

export function importersOf(manifest: ModuleManifest): ImporterMeta[] {
  const declared = manifest.contributions?.onboarding?.importers ?? [];
  return isDataApiModule(manifest) ? [...declared, jsonImporterMeta()] : declared;
}

/** True when the start-data wizard has something to offer (declared importers or the JSON import). */
export const hasStartData = (manifest: ModuleManifest): boolean => importersOf(manifest).length > 0;

export async function runtimeFor(
  manifest: ModuleManifest,
  importerId: string,
): Promise<ImporterRuntime> {
  if (importerId === JSON_IMPORTER_ID) return createJsonRuntime(manifest);
  return (await manifest.contributions!.onboarding!.load!()).default;
}
