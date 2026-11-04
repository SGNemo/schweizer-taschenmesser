import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/now';
import type { HeadlineFigure, ModuleManifest } from '@/core/modules/types';

/** The module's headline figure for its head (`contributions.headline`, shown in the head's figure slot); formatted by the module. */
export function useModuleHeadline(
  manifest: ModuleManifest | undefined,
): HeadlineFigure | undefined {
  const load = manifest?.contributions?.headline;
  return useLiveQuery(
    async () =>
      load ? ((await (await load()).default({ today: today() })) ?? undefined) : undefined,
    [manifest?.id, !!load],
  );
}
