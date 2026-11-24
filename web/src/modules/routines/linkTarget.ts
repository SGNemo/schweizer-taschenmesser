/**
 * Routines as link targets (`contributions.linkTarget`, docs/design/planner-hub-2/CONCEPT.md §1.3): reads only this
 * module's own data, never the network. The id is the routine's own – a plan row's occurrence key (`<id>:<due>`)
 * is no routine and resolves to `gone`, as does a foreign, malformed or soft-deleted id. A routine comes back
 * after every turn, so it has no „Erledigt“ and the answer carries no `done`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { routineRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const routine = await routineRepo.get(id);
    if (!routine) return { state: 'gone' };
    return { state: 'alive', title: routine.name, to: `/routines?open=${encodeURIComponent(id)}` };
  },
};

export default target;
