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
  category: 'sicherheit',
  get keywords() {
    return [...t.accounts.meta.settings.keywords];
  },
  schema: settingsSchema,
  defaults: defaultSettings,
  fields: [
    {
      key: 'autoLockMinutes',
      get label() {
        return t.accounts.meta.settings.autoLockMinutes;
      },
      type: 'select',
      options: [
        {
          value: '1',
          get label() {
            return t.accounts.meta.settings.autoLockMinutes_1;
          },
        },
        {
          value: '5',
          get label() {
            return t.accounts.meta.settings.autoLockMinutes_5;
          },
        },
        {
          value: '15',
          get label() {
            return t.accounts.meta.settings.autoLockMinutes_15;
          },
        },
        {
          value: '30',
          get label() {
            return t.accounts.meta.settings.autoLockMinutes_30;
          },
        },
      ],
    },
    {
      key: 'backgroundLock',
      get label() {
        return t.accounts.meta.settings.backgroundLock;
      },
      type: 'select',
      options: [
        {
          value: 'now',
          get label() {
            return t.accounts.meta.settings.backgroundLock_now;
          },
        },
        {
          value: '30s',
          get label() {
            return t.accounts.meta.settings.backgroundLock_30s;
          },
        },
      ],
    },
    {
      key: 'originMatch',
      get label() {
        return t.accounts.meta.settings.originMatch;
      },
      type: 'select',
      options: [
        {
          value: 'domain',
          get label() {
            return t.accounts.meta.settings.originMatch_domain;
          },
        },
        {
          value: 'host',
          get label() {
            return t.accounts.meta.settings.originMatch_host;
          },
        },
      ],
    },
    {
      key: 'genLength',
      get label() {
        return t.accounts.meta.settings.genLength;
      },
      type: 'select',
      options: [
        {
          value: '16',
          get label() {
            return t.accounts.meta.settings.genLength_16;
          },
        },
        {
          value: '20',
          get label() {
            return t.accounts.meta.settings.genLength_20;
          },
        },
        {
          value: '24',
          get label() {
            return t.accounts.meta.settings.genLength_24;
          },
        },
        {
          value: '32',
          get label() {
            return t.accounts.meta.settings.genLength_32;
          },
        },
      ],
    },
    {
      key: 'genSymbols',
      get label() {
        return t.accounts.meta.settings.genSymbols;
      },
      type: 'boolean',
    },
    {
      key: 'genAvoidAmbiguous',
      get label() {
        return t.accounts.meta.settings.genAvoidAmbiguous;
      },
      type: 'boolean',
    },
  ],
};
