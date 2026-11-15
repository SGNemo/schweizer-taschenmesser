import type { ModuleManifest } from '@/core/modules/types';

export const migrations: ModuleManifest['migrations'] = {
  // 0.6.0: the end date moved from `expiresOn` to `endDate` (the old field is still read, see `endOf`).
  2: async (ctx) => {
    await ctx.forEachRecord('document', (rec) => {
      if (typeof rec.expiresOn === 'string' && rec.endDate === undefined)
        return { endDate: rec.expiresOn, expiresOn: undefined };
    });
  },
  // 3: `noticeMonths`. A period that is a whole number of 30-day months was shown as "n Monate" but
  // computed with n × 30 days; it now counts calendar months, as displayed.
  3: (ctx) =>
    ctx.forEachRecord('document', (rec) => {
      const days = rec.noticeDays;
      if (rec.noticeMonths !== undefined || typeof days !== 'number') return;
      return days >= 30 && days % 30 === 0 ? { noticeMonths: days / 30 } : undefined;
    }),
  // 4: categories became their own collection (`category`). The built-in keys are their ids, so documents keep
  // their value; only a document without a usable one (very old or hand-imported data) moves to "Ohne Kategorie"
  // explicitly. Nothing is created here: built-in categories need no record (see `resolveCategories`).
  4: (ctx) =>
    ctx.forEachRecord('document', (rec) =>
      typeof rec.category === 'string' && rec.category.trim() !== ''
        ? undefined
        : { category: 'other' },
    ),
};
