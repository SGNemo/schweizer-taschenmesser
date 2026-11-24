/**
 * Merkliste entries as link targets (`contributions.linkTarget`, docs/design/planner-hub-2/CONCEPT.md §1.3): reads
 * only this module's own data, never the network. The title is the entry's title, never its URL. The id is
 * untrusted: anything that is no live entry here – a foreign or malformed id, a soft-deleted one – is `gone`. „done“
 * is the entry's own „Erledigt“: a link only reads it.
 */
import type { LinkTarget } from '@/core/modules/types';
import { itemRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const item = await itemRepo.get(id);
    if (!item) return { state: 'gone' };
    return {
      state: 'alive',
      title: item.title,
      to: `/bookmarks?open=${encodeURIComponent(id)}`,
      done: item.done === true,
    };
  },
};

export default target;
