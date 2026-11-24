/**
 * Subscriptions as link targets (`contributions.linkTarget`, docs/design/planner-hub-2/CONCEPT.md §1.3): reads only
 * this module's own data, never the network. The id is the subscription's own – a plan row's occurrence key
 * (`<id>:<date>`, `<id>:trial:<date>`) is no subscription and resolves to `gone`, as does a foreign, malformed or
 * soft-deleted id. A subscription has no „Erledigt“ of its own, so the answer carries no `done`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { subscriptionRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const sub = await subscriptionRepo.get(id);
    if (!sub) return { state: 'gone' };
    return { state: 'alive', title: sub.name, to: `/subscriptions?open=${encodeURIComponent(id)}` };
  },
};

export default target;
