import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  /** Lists appear in the planner (`plannable.ts`); only read while the planner is on. */
  showInPlan: z.boolean(),
  /** Id of the list the widget shows ('' = the first shopping list in use). Set from the list's "⋯" menu. */
  widgetList: z.string().max(80).default(''),
});
export const SETTINGS_SCOPE = 'module.lists';
export const SETTINGS_DEFAULTS = { showInPlan: true, widgetList: '' };

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: SETTINGS_DEFAULTS,
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
