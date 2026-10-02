import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { statusOf } from './logic';
import { documentRepo } from './repo';

/**
 * Cancellation deadlines within a week (accent), expired documents (danger) and documents that
 * expire soon (warning). Titles are never shown here.
 */
const source: AttentionSource = async ({ today }) => {
  const states = (await documentRepo.active().toArray()).map((d) => statusOf(d, today));
  const act = states.filter((s) => s === 'act-now').length;
  const expired = states.filter((s) => s === 'expired').length;
  const soon = states.filter((s) => s === 'soon').length;
  return [
    ...(act
      ? [
          {
            id: 'vault:act',
            tone: 'accent' as const,
            icon: 'file' as const,
            title: t.attention.contractsAct(act),
            to: '/vault',
            rank: 7,
          },
        ]
      : []),
    ...(expired
      ? [
          {
            id: 'vault:expired',
            tone: 'danger' as const,
            icon: 'file' as const,
            title: t.attention.docsExpired(expired),
            to: '/vault',
            rank: 6,
          },
        ]
      : []),
    ...(soon
      ? [
          {
            id: 'vault:soon',
            tone: 'warning' as const,
            icon: 'file' as const,
            title: t.attention.docsSoon(soon),
            to: '/vault',
            rank: 6,
          },
        ]
      : []),
  ];
};

export default source;
