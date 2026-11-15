/**
 * ToDos as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4): reads only this
 * module's own data, never the network. The id is untrusted: anything that is no live task here – a foreign or
 * malformed id, a soft-deleted one – is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { taskRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const task = await taskRepo.get(id);
    if (!task) return { state: 'gone' };
    return {
      state: 'alive',
      title: task.title,
      to: `/todos?open=${encodeURIComponent(id)}`,
      done: task.done,
    };
  },
};

export default target;
