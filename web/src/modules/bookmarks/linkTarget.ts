/**
 * Merkliste entries as link targets (`contributions.linkTarget`, docs/design/planner-hub-2/CONCEPT.md §1.3): reads
 * only this module's own data, never the network. The title is the entry's title, never its URL (an
 * untitled import, whose title is the URL, reads as its kind's word). The id is
 * untrusted: anything that is no live entry here – a foreign or malformed id, a soft-deleted one – is `gone`. „done“
 * is the entry's own „Erledigt“: a link only reads it.
 */
import type { LinkTarget } from '@/core/modules/types';
import { t } from '@/strings';
import { itemRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const item = await itemRepo.get(id);
    if (!item) return { state: 'gone' };
    return {
      state: 'alive',
      // An import without a title stores the URL as the title: then the kind's word, never the address.
      title:
        item.url && item.title.trim() === item.url.trim()
          ? t.bookmarks.kinds[item.kind] || t.bookmarks.title
          : item.title,
      to: `/bookmarks?open=${encodeURIComponent(id)}`,
      done: item.done === true,
    };
  },
};

export default target;
