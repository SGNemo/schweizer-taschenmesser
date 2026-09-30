import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  /** Minutes without interaction until the vault locks. */
  autoLockMinutes: z.enum(['1', '5', '15', '30']),
  /** When the app goes to the background: lock at once or after 30 s. */
  backgroundLock: z.enum(['now', '30s']),
});
export type AccountsSettings = z.output<typeof settingsSchema>;

export const defaultSettings: AccountsSettings = { autoLockMinutes: '5', backgroundLock: 'now' };

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: defaultSettings,
  fields: [
    {
      key: 'autoLockMinutes',
      label: 'Tresor sperren nach Inaktivität',
      type: 'select',
      options: [
        { value: '1', label: '1 Minute' },
        { value: '5', label: '5 Minuten' },
        { value: '15', label: '15 Minuten' },
        { value: '30', label: '30 Minuten' },
      ],
    },
    {
      key: 'backgroundLock',
      label: 'Tresor sperren, wenn die App im Hintergrund ist',
      type: 'select',
      options: [
        { value: 'now', label: 'Sofort' },
        { value: '30s', label: 'Nach 30 Sekunden' },
      ],
    },
  ],
};
