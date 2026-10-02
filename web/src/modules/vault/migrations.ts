import type { ModuleManifest } from '@/core/modules/types';

export const migrations: ModuleManifest['migrations'] = {
  // 0.6.0: the end date moved from `expiresOn` to `endDate` (the old field is still read, see `endOf`).
  2: async (ctx) => {
    await ctx.forEachRecord('document', (rec) => {
      if (typeof rec.expiresOn === 'string' && rec.endDate === undefined)
        return { endDate: rec.expiresOn, expiresOn: undefined };
    });
  },
};
