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
  get name() {
    return s.name;
  },
  get description() {
    return s.description;
  },
  icon: 'calendar',
  authType: 'oauth-pkce',
  platforms: ['desktop'],
  get unavailableHint() {
    return t.connectors.desktopOnly;
  },
  oauth: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    // offline + consent: Google only returns a refresh token on an explicit consent screen. No
    // `include_granted_scopes`: the token carries exactly the scopes of the chosen features.
    authParams: { access_type: 'offline', prompt: 'consent' },
  },
  features: [
    {
      id: 'calendar',
      get label() {
        return s.calendarFeature;
      },
      get description() {
        return s.calendarFeatureHint;
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
    {
      id: 'mail',
      get label() {
        return s.mailFeature;
      },
      get description() {
        return s.mailFeatureHint;
      },
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
  ],
  calendar: googleCalendar,
  mail: googleMail,
};

export default connector;
