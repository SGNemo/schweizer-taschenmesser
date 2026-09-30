import type { ConnectorDef } from '@/core/connectors/types';
import { loadSubscriptions } from './subscriptions';
import { syncIcs } from './sync';

/**
 * Calendar subscription by address (ICS/iCal, e.g. "secret address in iCal format" of Google
 * Calendar, Outlook.com, Nextcloud, school and club calendars). No login; works on every platform –
 * in the browser through the sync server's proxy.
 */
const connector: ConnectorDef = {
  id: 'ics',
  name: 'Kalender-Abo (ICS)',
  description:
    'Termine aus einer Kalender-Adresse übernehmen (nur lesen). Funktioniert mit Google Kalender, Outlook, Nextcloud und vielen anderen.',
  icon: 'calendar',
  authType: 'none',
  platforms: ['web', 'desktop', 'android'],
  features: [],
  isConfigured: async (ctx) => (await loadSubscriptions(ctx)).length > 0,
  settings: () => import('./Settings'),
  calendar: {
    async listCalendars(ctx) {
      return (await loadSubscriptions(ctx)).map((s) => ({ id: s.id, name: s.name, primary: true }));
    },
    sync: syncIcs,
  },
};

export default connector;
