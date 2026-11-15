import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  /** Lists appear in the planner (`plannable.ts`); only read while the planner is on. */
  showInPlan: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { showInPlan: true },
  fields: [
    {
      key: 'showInPlan',
      get label() {
        return t.lists.meta.settings.showInPlan;
      },
      type: 'boolean',
      get help() {
        return t.lists.meta.settings.showInPlanHelp;
      },
    },
  ],
};
