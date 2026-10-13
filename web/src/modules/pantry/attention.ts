import type { AttentionSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { expiryState, needsRestock } from './logic';
import { itemRepo } from './repo';
import { settings, settingsSchema } from './settings';

/** Expired stock (danger), stock that expires soon and stock that runs low (warning). */
const source: AttentionSource = async ({ today }) => {
  const prefs = await getSettings('module.pantry', settingsSchema, settings.defaults as never);
  const soonDays = (prefs as { soonDays?: number }).soonDays ?? 3;
  const items = await itemRepo.active().toArray();
  const states = items.map((i) => expiryState(i, today, soonDays));
  const low = items.filter(needsRestock).length;
  const expired = states.filter((s) => s === 'expired').length;
  const soon = states.filter((s) => s === 'soon').length;
  return [
    ...(expired
      ? [
          {
            id: 'pantry:expired',
            tone: 'danger' as const,
            icon: 'package' as const,
            title: t.attention.pantryExpired(expired),
            to: '/pantry',
            rank: 5,
          },
        ]
      : []),
    ...(low
      ? [
          {
            id: 'pantry:low',
            tone: 'warning' as const,
            icon: 'package' as const,
            title: t.attention.pantryLow(low),
            to: '/pantry',
            rank: 6,
          },
        ]
      : []),
    ...(soon
      ? [
          {
            id: 'pantry:soon',
            tone: 'warning' as const,
            icon: 'package' as const,
            title: t.attention.pantrySoon(soon),
            to: '/pantry',
            rank: 5,
          },
        ]
      : []),
  ];
};

export default source;
