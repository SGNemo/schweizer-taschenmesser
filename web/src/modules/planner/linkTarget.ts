/**
 * The planner as a link target (planner hub 2, package 11): only its topics (`planner:t_<id>`, CONCEPT §1.1). Reads only
 * the planner's own data, never the network. The id is untrusted: anything that is no live topic – another planner key
 * (a pile, a plan row), a malformed or foreign id, a deleted topic – is `gone`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { topicRepo } from './repo';
import { TOPIC_ID } from './schema';

const target: LinkTarget = {
  async resolve(id) {
    if (!TOPIC_ID.test(id)) return { state: 'gone' };
    const topic = await topicRepo.get(id);
    if (!topic) return { state: 'gone' };
    return {
      state: 'alive',
      title: topic.title,
      // The planner shrunk to this topic (the page reads `?topic=` once and keeps it as device state).
      to: `/planner?topic=${encodeURIComponent(id)}`,
    };
  },
};

export default target;
