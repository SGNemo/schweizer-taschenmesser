import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

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
  keywords: ['Tresor', 'Passwort', 'Sperre', 'Auto-Lock', 'Browser-Erweiterung'],
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
    {
      key: 'originMatch',
      label: 'Browser-Erweiterung: Zugangsdaten anbieten für',
      type: 'select',
      options: [
        { value: 'domain', label: 'Dieselbe Domain (login.beispiel.de passt zu beispiel.de)' },
        { value: 'host', label: 'Genau denselben Host' },
      ],
    },
    {
      key: 'genLength',
      label: 'Browser-Erweiterung: Länge neuer Passwörter',
      type: 'select',
      options: [
        { value: '16', label: '16 Zeichen' },
        { value: '20', label: '20 Zeichen' },
        { value: '24', label: '24 Zeichen' },
        { value: '32', label: '32 Zeichen' },
      ],
    },
    { key: 'genSymbols', label: 'Browser-Erweiterung: Sonderzeichen verwenden', type: 'boolean' },
    {
      key: 'genAvoidAmbiguous',
      label: 'Browser-Erweiterung: Ähnliche Zeichen vermeiden (Il1O0)',
      type: 'boolean',
    },
  ],
};
