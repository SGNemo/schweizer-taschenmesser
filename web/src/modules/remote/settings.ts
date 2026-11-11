import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

/** Harmless comfort switches of the phone. Nothing here is about what the phone may do at the PC. */
const schema = z.object({
  haptics: z.boolean(),
  keepAwake: z.boolean(),
  volumeKeys: z.boolean(),
  padSpeed: z.enum(['slow', 'normal', 'fast']),
  /** The touchpad's one-time legend was closed. */
  padLegendSeen: z.boolean(),
});

/** The factor of each speed (the PC adds its own pointer speed and acceleration). */
export const PAD_SPEED: Record<RemotePrefs['padSpeed'], number> = {
  slow: 0.6,
  normal: 1,
  fast: 1.7,
};

export type RemotePrefs = z.output<typeof schema>;

export const DEFAULTS: RemotePrefs = {
  haptics: true,
  keepAwake: false,
  volumeKeys: true,
  padSpeed: 'normal',
  padLegendSeen: false,
};

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
    {
      key: 'volumeKeys',
      get label() {
        return t.remote.meta.volumeKeys;
      },
      get help() {
        return t.remote.meta.volumeKeysHelp;
      },
      type: 'boolean',
    },
    {
      key: 'padSpeed',
      get label() {
        return t.remote.meta.padSpeed;
      },
      get help() {
        return t.remote.meta.padSpeedHelp;
      },
      type: 'select',
      get options() {
        const m = t.remote.meta;
        return [
          { value: 'slow', label: m.padSlow },
          { value: 'normal', label: m.padNormal },
          { value: 'fast', label: m.padFast },
        ];
      },
    },
  ],
};
