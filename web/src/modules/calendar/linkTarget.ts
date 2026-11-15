/**
 * The calendar's own events as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4): reads only this
 * module's own data, never the network. The id is untrusted: anything that is no live event here – a foreign or
 * malformed id, a soft-deleted one – is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { eventRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const event = await eventRepo.get(id);
    if (!event) return { state: 'gone' };
    return { state: 'alive', title: event.title, to: `/calendar?open=${encodeURIComponent(id)}` };
  },
};

export default target;
