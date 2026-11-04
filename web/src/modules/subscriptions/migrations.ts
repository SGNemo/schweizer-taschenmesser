import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: every subscription gets an (empty) price history; "gekündigt zum" uses the recurrence end.
 */
/**
 * (3: optional `currency`; a record without one is in euro, so nothing is rewritten.)
 */
export const migrations: ModuleManifest['migrations'] = {
  2: (ctx) => ctx.forEachRecord('subscription', (r) => ({ priceHistory: r.priceHistory ?? [] })),
  3: () => Promise.resolve(),
  // 4: optional `trialEndsOn`, `category`, `paymentMethod`; absent means "as before", nothing is rewritten.
  4: () => Promise.resolve(),
  // 5: `cancelNoticeMonths`. A period that is a whole number of 30-day months was shown as "n Monate"
  // but computed with n × 30 days; it now counts calendar months, as displayed.
  5: (ctx) =>
    ctx.forEachRecord('subscription', (r) => {
      const days = r.cancelNoticeDays;
      if (r.cancelNoticeMonths !== undefined || typeof days !== 'number') return;
      return days >= 30 && days % 30 === 0 ? { cancelNoticeMonths: days / 30 } : undefined;
    }),
};
