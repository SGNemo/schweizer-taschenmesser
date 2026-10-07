import type { Strings } from '@/strings';

export const connectors: Strings['connectors'] = {
  title: 'Connections',
  errors: {
    expired: 'The connection has expired. Please sign in again.',
    'rate-limited': 'The service reported too many requests. It will try again later.',
    'not-configured': 'Credentials are still missing.',
    'no-proxy': 'In the browser, this fetch needs the sync server (Settings → Sync).',
    network: 'The service can’t be reached right now.',
    denied: 'Sign-in was cancelled or denied.',
    'bad-response': 'The service sent an unexpected response.',
    unsupported: 'That isn’t possible on this device.',
  } as Record<string, string>,
  icsName: 'Calendar subscription (ICS)',
  icsDescription:
    'Bring in events from a calendar address (read-only). Works with Google Calendar, Outlook, Nextcloud and many others.',
  intro: 'Bring in events and suggestions from services you already use. Everything is read-only.',
  statusLabel: 'Status',
  status: {
    disconnected: 'Not connected',
    connected: 'Connected',
    expired: 'Expired',
    'rate-limited': 'Paused',
    error: 'Error',
  } as Record<string, string>,
  lastSync: (when: string) => `Last synced: ${when}`,
  events: (n: number) => (n === 1 ? '1 event imported' : `${n} events imported`),
  connect: 'Connect',
  reconnect: 'Sign in again',
  cancelLogin: 'Cancel sign-in',
  connecting: 'Waiting for sign-in in the browser …',
  disconnect: 'Disconnect',
  syncNow: 'Sync now',
  syncing: 'Syncing …',
  syncDone: (added: number, updated: number, removed: number) =>
    `Done: ${added} new, ${updated} changed, ${removed} removed.`,
  desktopOnly:
    'Sign-in only works in the Windows app. On your phone and in the browser, events arrive via sync or a calendar subscription (ICS).',
  features: 'What should be read?',
  calendars: 'Calendars',
  calendarsHint: 'Only the ticked calendars are imported.',
  disconnectTitle: (name: string) => `Disconnect ${name}?`,
  disconnectBody:
    'Access is revoked at the service and the stored sign-in data is deleted from this device.',
  keepData: 'Keep imported events',
  deleteData: 'Delete imported events',
  client: {
    title: 'Your own Google app',
    intro:
      'To sign in, you need your own “OAuth client ID” (type Desktop app) from the Google Cloud Console. The guide is in docs/MANUAL-TESTS.md under “Anleitungen für Sven”.',
    id: 'Client ID',
    secret: 'Client secret',
    secretHint: 'Google requires it for desktop apps too; there it isn’t considered confidential.',
    save: 'Save',
    saved: 'Credentials saved.',
    missing: 'Enter the client ID first.',
  },
  scan: {
    title: 'Search emails',
    intro:
      'From your recent emails, the app only reads sender, subject, date and the preview line, and looks locally for invoices, subscriptions, events and contracts. Only what you confirm in the preview is saved; the email text itself is never saved and never sent to an AI.',
    period: 'Period',
    months: (n: number) => (n === 1 ? 'Last month' : `Last ${n} months`),
    start: 'Read emails',
    reading: (done: number, total: number) => `Reading emails … ${done} of ${total}`,
    summary: (n: number, months: number) =>
      `Read ${n} ${n === 1 ? 'email' : 'emails'} from the last ${months === 1 ? 'month' : `${months} months`} (sender, subject, date, preview line).`,
    notConnected: 'First connect Google under Settings → Connections and turn on “Emails”.',
    none: 'Nothing relevant was found in these emails.',
  },
  ics: {
    listLabel: 'Calendar subscriptions',
    name: 'Name (optional)',
    defaultName: (n: number) => `Calendar ${n}`,
    url: 'Calendar address',
    urlHint:
      'e.g. in Google Calendar: Settings → Calendar → Integrate → “Secret address in iCal format”. Don’t share it.',
    add: 'Add calendar',
    checking: 'Checking …',
    remove: (name: string) => `Remove calendar “${name}”`,
    badUrl: 'That isn’t a valid address (https://… or webcal://…).',
    notACalendar: 'There is no calendar at this address.',
    unreachable: 'The address can’t be reached.',
    noProxy:
      'In the browser, this needs the sync server (Settings → Sync), because calendar services block fetching from the browser.',
  },
  google: {
    name: 'Google',
    description:
      'Read calendars and search emails for invoices, subscriptions, events and contracts. Read-only.',
    calendarFeature: 'Calendar',
    calendarFeatureHint: 'Show events from your Google calendars.',
    mailFeature: 'Emails',
    mailFeatureHint:
      'Search for invoices, subscriptions, events and contracts at the press of a button.',
  },
};
