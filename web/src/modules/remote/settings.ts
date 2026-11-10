import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

/** Harmless comfort switches of the phone. Nothing here is about what the phone may do at the PC. */
const schema = z.object({
  haptics: z.boolean(),
  keepAwake: z.boolean(),
});

export type RemotePrefs = z.output<typeof schema>;

export const DEFAULTS: RemotePrefs = { haptics: true, keepAwake: false };

export const settings: ModuleSettings = {
  schema,
  defaults: DEFAULTS,
  fields: [
    {
      key: 'haptics',
      get label() {
        return t.remote.meta.haptics;
      },
      get help() {
        return t.remote.meta.hapticsHelp;
      },
      type: 'boolean',
    },
    {
      key: 'keepAwake',
      get label() {
        return t.remote.meta.keepAwake;
      },
      get help() {
        return t.remote.meta.keepAwakeHelp;
      },
      type: 'boolean',
    },
  ],
};
