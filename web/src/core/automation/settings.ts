/**
 * Automation settings (synced scope `automation`): the master switch, the dry-run switch, the global
 * limit and, per template, on/off plus its parameters. Everything is off until the user switches it on.
 */
import { z } from 'zod';
import { getSettings, setSettings, useSettings } from '@/core/settings/settings';

export const AUTOMATION_SCOPE = 'automation';

const param = z.union([z.string().max(200), z.number(), z.boolean()]);

export const automationSettingsSchema = z.object({
  /** Master switch: without it nothing runs and nothing is watched. */
  enabled: z.boolean(),
  /** Rules only write log lines ("would do …"), nothing else. */
  dryRun: z.boolean(),
  /** All rules together, per hour. 0 = no global limit. */
  globalPerHour: z.number().int().min(0).max(60),
  /** Per template id. */
  rules: z.record(
    z.string().max(60),
    z.object({ enabled: z.boolean(), params: z.record(z.string().max(40), param) }),
  ),
});
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const AUTOMATION_DEFAULTS: AutomationSettings = {
  enabled: false,
  dryRun: false,
  globalPerHour: 10,
  rules: {},
};

export const getAutomationSettings = (): Promise<AutomationSettings> =>
  getSettings(AUTOMATION_SCOPE, automationSettingsSchema, AUTOMATION_DEFAULTS);

export const setAutomationSettings = (patch: Partial<AutomationSettings>): Promise<void> =>
  setSettings(AUTOMATION_SCOPE, patch, AUTOMATION_DEFAULTS);

export const useAutomationSettings = () =>
  useSettings(AUTOMATION_SCOPE, automationSettingsSchema, AUTOMATION_DEFAULTS);
