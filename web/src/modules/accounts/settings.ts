import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  /** Minutes without interaction until the vault locks. */
  autoLockMinutes: z.enum(['1', '5', '15', '30']),
  /** When the app goes to the background: lock at once or after 30 s. */
  backgroundLock: z.enum(['now', '30s']),
  /** Which pages the browser extension may fill: the same registrable domain or exactly the host. */
  originMatch: z.enum(['domain', 'host']),
  /** Generator defaults the extension uses for new passwords. */
  genLength: z.enum(['16', '20', '24', '32']),
  genSymbols: z.boolean(),
  genAvoidAmbiguous: z.boolean(),
});
export type FullAccountsSettings = z.output<typeof settingsSchema>;
/** What the auto-lock needs; the other fields belong to the browser extension bridge. */
export type AccountsSettings = Pick<FullAccountsSettings, 'autoLockMinutes' | 'backgroundLock'>;

export const defaultSettings: FullAccountsSettings = {
  autoLockMinutes: '5',
  backgroundLock: 'now',
  originMatch: 'domain',
  genLength: '20',
  genSymbols: true,
  genAvoidAmbiguous: false,
};

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: defaultSettings,
  fields: [
    {
      key: 'autoLockMinutes',
      label: t.accounts.meta.settings.autoLockMinutes,
      type: 'select',
      options: [
        { value: '1', label: t.accounts.meta.settings.autoLockMinutes_1 },
        { value: '5', label: t.accounts.meta.settings.autoLockMinutes_5 },
        { value: '15', label: t.accounts.meta.settings.autoLockMinutes_15 },
        { value: '30', label: t.accounts.meta.settings.autoLockMinutes_30 },
      ],
    },
    {
      key: 'backgroundLock',
      label: t.accounts.meta.settings.backgroundLock,
      type: 'select',
      options: [
        { value: 'now', label: t.accounts.meta.settings.backgroundLock_now },
        { value: '30s', label: t.accounts.meta.settings.backgroundLock_30s },
      ],
    },
    {
      key: 'originMatch',
      label: t.accounts.meta.settings.originMatch,
      type: 'select',
      options: [
        { value: 'domain', label: t.accounts.meta.settings.originMatch_domain },
        { value: 'host', label: t.accounts.meta.settings.originMatch_host },
      ],
    },
    {
      key: 'genLength',
      label: t.accounts.meta.settings.genLength,
      type: 'select',
      options: [
        { value: '16', label: t.accounts.meta.settings.genLength_16 },
        { value: '20', label: t.accounts.meta.settings.genLength_20 },
        { value: '24', label: t.accounts.meta.settings.genLength_24 },
        { value: '32', label: t.accounts.meta.settings.genLength_32 },
      ],
    },
    { key: 'genSymbols', label: t.accounts.meta.settings.genSymbols, type: 'boolean' },
    {
      key: 'genAvoidAmbiguous',
      label: t.accounts.meta.settings.genAvoidAmbiguous,
      type: 'boolean',
    },
  ],
};
