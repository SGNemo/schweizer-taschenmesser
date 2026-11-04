import { useLiveQuery } from 'dexie-react-hooks';
import { feedRepo } from '../repo';

/** Live data of the widget: number of feeds and of named groups (`undefined` while loading). */
export function useSummary() {
  return useLiveQuery(async () => {
    const feeds = await feedRepo.active().toArray();
    const groups = new Set(feeds.map((f) => f.category.trim()).filter(Boolean));
    return { count: feeds.length, groups: groups.size };
  }, []);
}
