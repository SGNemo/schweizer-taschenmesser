import type { ConnectorDef } from '@/core/connectors/types';
import IcsSettings from './Settings';
import { loadSubscriptions } from './subscriptions';
import { syncIcs } from './sync';
import { t } from '@/strings';

/**
 * Calendar subscription by address (ICS/iCal, e.g. "secret address in iCal format" of Google
 * Calendar, Outlook.com, Nextcloud, school and club calendars). No login; works on every platform –
 * in the browser through the sync server's proxy.
 */
const connector: ConnectorDef = {
  id: 'ics',
  get name() {
    return t.connectors.icsName;
  },
  get description() {
    return t.connectors.icsDescription;
  },
  icon: 'calendar',
  authType: 'none',
  platforms: ['web', 'desktop', 'android'],
  features: [],
  isConfigured: async (ctx) => (await loadSubscriptions(ctx)).length > 0,
  settings: IcsSettings,
  secretNames: ['subscriptions'],
  calendar: {
    async listCalendars(ctx) {
      return (await loadSubscriptions(ctx)).map((s) => ({ id: s.id, name: s.name, primary: true }));
    },
    sync: syncIcs,
  },
};

export default connector;
