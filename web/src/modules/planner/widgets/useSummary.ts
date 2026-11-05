import { useLiveQuery } from 'dexie-react-hooks';
import { entryRepo } from '../repo';

/** Live data of the widget: the open entries (`undefined` while loading). Reads only own data. */
export function useSummary() {
  return useLiveQuery(
    async () => (await entryRepo.active().toArray()).filter((e) => !e.done).slice(0, 4),
    [],
  );
}
