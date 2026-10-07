import type { Strings } from '@/strings';

export const notifications: Strings['notifications'] = {
  summary: (count: number, titles: string[]) => ({
    title: `More reminders · ${count}`,
    body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ' …' : ''),
  }),
  title: 'Notifications',
  intro:
    'Reminders appear as notifications while the app is open or running in the background. When the app is closed, they only arrive with push (see below).',
  enable: 'Turn on notifications',
  granted: 'On',
  denied: 'Blocked – please allow them for this site in your browser settings.',
  default: 'Not turned on yet',
  unsupported: 'Not supported by this browser.',
  test: 'Send test notification',
  testBody: 'It works.',
  push: {
    title: 'Push when the app is closed',
    intro:
      'Optional: your sync server sends reminders via Web Push, even when the app is closed. For this, the app uploads the upcoming notifications of the next two weeks (title and text) to your server – encrypted only, when end-to-end encryption is on.',
    state: {
      unsupported: 'This browser doesn’t support Web Push.',
      'needs-sync': 'Push needs the connection to your sync server (Settings → Sync).',
      denied: 'Notifications are blocked – please allow them in your browser settings.',
      off: 'Off',
      on: 'Active on this device',
    } as Record<string, string>,
    enable: 'Turn on push',
    disable: 'Turn off push',
    test: 'Send test via the server',
    testSent: 'Sent – the notification should appear in a moment.',
    testFailed: 'The server couldn’t send (push service unreachable?).',
    errors: {
      unauthorized: 'The sync server rejected the token.',
      network: 'The sync server can’t be reached.',
      server: 'The sync server reported an error (is it up to date?).',
      'subscribe-failed':
        'The subscription couldn’t be created. Push needs HTTPS and a browser with a push service.',
      denied: 'Notifications were not allowed.',
      unsupported: 'This browser doesn’t support Web Push.',
      'needs-sync': 'Please connect to the sync server first.',
    } as Record<string, string>,
  },
};
