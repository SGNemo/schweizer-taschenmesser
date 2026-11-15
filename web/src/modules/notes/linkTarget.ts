/**
 * Notes as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4): reads only this
 * module's own data, never the network. The id is untrusted: anything that is no live note here – a foreign or
 * malformed id, a soft-deleted one – is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { noteRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const note = await noteRepo.get(id);
    if (!note) return { state: 'gone' };
    return {
      state: 'alive',
      title: note.title.trim(),
      to: `/notes?open=${encodeURIComponent(id)}`,
    };
  },
};

export default target;
