import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { cancelDeadline, statusOf } from './logic';
import { documentRepo } from './repo';

/**
 * Cancellation deadlines: the ones that end today are an entry of their own (accent, `due`: it never folds
 * behind "nichts davon muss heute sein"), the ones of the next seven days one calm entry (warning). Expired and
 * soon-expiring documents are warning too (red is kept for overdue money and exceeded budgets, FOCUS-GUIDELINES,
 * C24). Titles are never shown here.
 */
const source: AttentionSource = async ({ today }) => {
  const docs = await documentRepo.active().toArray();
  const states = docs.map((d) => statusOf(d, today));
  const actToday = docs.filter(
    (d, i) => states[i] === 'act-now' && cancelDeadline(d) === today,
  ).length;
  const act = states.filter((s) => s === 'act-now').length - actToday;
  const expired = states.filter((s) => s === 'expired').length;
  const soon = states.filter((s) => s === 'soon').length;
  return [
    ...(actToday
      ? [
          {
            id: 'vault:act-today',
            tone: 'accent' as const,
            icon: 'file' as const,
            title: t.attention.contractsActToday(actToday),
            to: '/vault',
            rank: 7,
            due: 'today' as const,
          },
        ]
      : []),
    ...(act
      ? [
          {
            id: 'vault:act',
            tone: 'warning' as const,
            icon: 'file' as const,
            title: t.attention.contractsAct(act),
            to: '/vault',
            rank: 5,
          },
        ]
      : []),
    ...(expired
      ? [
          {
            id: 'vault:expired',
            tone: 'warning' as const,
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
