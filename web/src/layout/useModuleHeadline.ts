import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/now';
import type { HeadlineFigure, ModuleManifest } from '@/core/modules/types';

/**
 * The module's headline figure for its head (`contributions.headline`, shown in the head's figure slot); formatted by the
 * module. `pending` while a declared figure is still loading: the frame keeps its place, so the head does not grow when
 * the number arrives (U01).
 */
export function useModuleHeadline(manifest: ModuleManifest | undefined): {
  figure?: HeadlineFigure;
  pending: boolean;
} {
  const load = manifest?.contributions?.headline;
  const result = useLiveQuery(
    async () => ({
      figure: load ? ((await (await load()).default({ today: today() })) ?? undefined) : undefined,
    }),
    [manifest?.id, !!load],
  );
  return { figure: result?.figure, pending: !!load && !result };
}
