import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/now';
import type { HeadlineFigure, ModuleManifest } from '@/core/modules/types';

/** The module's headline figure for its head (`identity.head: 'figure'` with `contributions.headline`); formatted by the module. */
export function useModuleHeadline(
  manifest: ModuleManifest | undefined,
): HeadlineFigure | undefined {
  const load = manifest?.identity.head === 'figure' ? manifest.contributions?.headline : undefined;
  return useLiveQuery(
    async () =>
      load ? ((await (await load()).default({ today: today() })) ?? undefined) : undefined,
    [manifest?.id, !!load],
  );
}
