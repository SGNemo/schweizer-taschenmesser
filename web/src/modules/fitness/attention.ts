import type { AttentionSource } from '@/core/modules/types';
import { notDeleted } from '@/core/db/repo';
import { t } from '@/strings';
import { sessionTitle } from './data';
import { sessionRepo } from './repo';

/**
 * Only what the user set: a session planned for today *with a time* („Heute 18:00 · Training: Beine“), one
 * calm accent line each. Never „heute noch nicht trainiert“, never anything for meals or goals.
 */
const source: AttentionSource = async ({ today }) => {
  const planned = await sessionRepo.table
    .where('date')
    .equals(today)
    .filter((s) => notDeleted(s) && s.planned === true && !!s.time)
    .toArray();
  return planned
    .sort((a, b) => a.time!.localeCompare(b.time!))
    .map((s) => ({
      id: `fitness:planned:${s.id}`,
      tone: 'accent' as const,
      icon: 'dumbbell' as const,
      title: t.fitness.planned.attention(s.time!, sessionTitle(s)),
      to: `/fitness?open=${encodeURIComponent(s.id)}`,
      rank: 8,
    }));
};

export default source;
