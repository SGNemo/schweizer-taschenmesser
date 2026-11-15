/**
 * Lists and their entries as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md
 * §1.4): reads only this module's own data, never the network. The id is untrusted: anything that is neither a
 * live list nor a live entry here is `gone`. An entry's „done“ is its own tick – a link only reads it.
 */
import type { LinkTarget } from '@/core/modules/types';
import { itemRepo, listRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const to = `/lists?open=${encodeURIComponent(id)}`;
    const list = await listRepo.get(id);
    if (list) return { state: 'alive', title: list.name, to };
    const item = await itemRepo.get(id);
    if (!item) return { state: 'gone' };
    return { state: 'alive', title: item.name, to, done: item.done };
  },
};

export default target;
