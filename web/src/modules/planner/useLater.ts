/**
 * The things kept for „Nächste Wochen“, live (use case „Tag kippt“): the sources' `listLater` inside a shared live
 * query whose source chunks are loaded first – a lazy `import()` inside the query would stop Dexie from tracking the
 * reads after it (docs/howto/gotchas.md), as `usePlannable` does for `list`.
 */
import type { PlannableEntry } from '@/core/modules/contributions';
import { activeManifests } from '@/core/modules/contributions';
import { useModuleStates } from '@/core/modules/activation';
import { useSharedLiveQuery } from '@/core/modules/sharedQuery';
import { laterThings } from './actions';

export function useLater(): PlannableEntry[] | undefined {
  const states = useModuleStates();
  const manifests = activeManifests(states);
  return useSharedLiveQuery(
    `planner-later|${manifests.map((m) => m.id).join(',')}|${states === undefined}`,
    async () => (states ? laterThings(manifests) : undefined),
    () => Promise.all(manifests.map((m) => m.contributions?.plannable?.())),
  );
}
