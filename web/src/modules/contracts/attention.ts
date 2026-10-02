import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { statusOf } from './logic';
import { contractRepo } from './repo';

/** Contracts whose cancellation deadline is at most a week away (accent: act now, not yet late). */
const source: AttentionSource = async ({ today }) => {
  const n = (await contractRepo.active().toArray()).filter(
    (c) => statusOf(c, today) === 'act-now',
  ).length;
  return n
    ? [
        {
          id: 'contracts:act',
          tone: 'accent' as const,
          icon: 'file' as const,
          title: t.attention.contractsAct(n),
          to: '/contracts',
          rank: 7,
        },
      ]
    : [];
};

export default source;
