import type { ConnectorDef } from '@/core/connectors/types';
import { t } from '@/strings';
import { googleCalendar } from './calendar';
import { googleMail } from './mail';

const s = t.connectors.google;

/**
 * Google: calendar (read) and Gmail suggestions (read). The user brings their own OAuth client
 * ("Desktop app" type) – no client id or secret is shipped with the app. Desktop only for now: the
 * login needs a loopback redirect.
 */
const connector: ConnectorDef = {
  id: 'google',
  name: s.name,
  description: s.description,
  icon: 'calendar',
  authType: 'oauth-pkce',
  platforms: ['desktop'],
  unavailableHint: t.connectors.desktopOnly,
  oauth: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    // offline + consent: Google only returns a refresh token on an explicit consent screen.
    authParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  features: [
    {
      id: 'calendar',
      label: s.calendarFeature,
      description: s.calendarFeatureHint,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
    {
      id: 'mail',
      label: s.mailFeature,
      description: s.mailFeatureHint,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
  ],
  calendar: googleCalendar,
  mail: googleMail,
};

export default connector;
