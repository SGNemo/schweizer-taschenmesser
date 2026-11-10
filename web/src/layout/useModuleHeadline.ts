import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/now';
import type { HeadlineFigure, ModuleManifest } from '@/core/modules/types';

/**
 * The module's headline figure for its head (`contributions.headline`, shown in the head's figure slot); formatted by the
 * module. `pending` while a declared figure is still loading: the frame keeps its place, so the head does not grow when
 * the number arrives (U01). A figure that fails to load is left out.
 */
export function useModuleHeadline(manifest: ModuleManifest | undefined): {
  figure?: HeadlineFigure;
  pending: boolean;
} {
  const load = manifest?.contributions?.headline;
  const result = useLiveQuery(async () => {
    if (!load) return { figure: undefined };
    try {
      return { figure: (await (await load()).default({ today: today() })) ?? undefined };
    } catch (e) {
      // The frame sits outside the module's error boundary: a figure that cannot load (its code did not arrive,
      // the source threw) must not take the app down. The head shows no figure, like the cockpit (`collectHeadlines`).
      console.error(`[headline] source "${manifest.id}" failed`, e);
      return { figure: undefined };
    }
  }, [manifest?.id, !!load]);
  return { figure: result?.figure, pending: !!load && !result };
}
