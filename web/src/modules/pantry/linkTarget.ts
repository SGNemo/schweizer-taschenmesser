/**
 * Pantry entries as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4): the
 * shopping-list entry made from „Wird knapp“ leads back here. Reads only this module's own data, never the
 * network. The id is untrusted: anything that is no live entry here is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { itemRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const item = await itemRepo.get(id);
    if (!item) return { state: 'gone' };
    return { state: 'alive', title: item.name, to: `/pantry?open=${encodeURIComponent(id)}` };
  },
};

export default target;
