import type { Strings } from '@/strings';

export const update: Strings['update'] = {
  title: 'App updates',
  available: (version: string) => `Update available (v${version})`,
  beta: 'Beta',
  whatsNew: 'What’s new?',
  updateNow: 'Update now',
  later: 'Later',
  backingUp: 'Making a backup of your data …',
  downloading: 'Downloading update …',
  downloadingPercent: (pct: number) => `Downloading update … ${pct} %`,
  handover: 'Almost done – the app will restart in a moment, or Android will open the installer.',
  needsPermission:
    'Android still needs your permission to install apps from this source. Turn on the switch in Settings, then tap “Update now” again.',
  retry: 'Try again',
  errors: {
    'check-failed': 'Checking for updates failed. Are you online?',
    'backup-failed': 'The backup could not be made – so the update was not started.',
    'install-failed': 'The update could not be installed.',
    'folder-not-writable':
      'The program file is in a folder the app may not write to (read-only or no permission). Move the program file to a normal folder, such as your user folder, and try again.',
    'signature-invalid': 'The update’s signature is invalid – so it was not installed.',
  } as Record<string, string>,
  settings: {
    intro:
      'The installed app checks GitHub for a new version. Before every update it automatically makes a backup of your data.',
    version: 'Installed version',
    channel: 'Update channel',
    channelStable: 'Stable',
    channelBeta: 'Beta (includes pre-releases)',
    auto: 'Check for updates automatically',
    autoHint: 'At most once a day, when the app starts.',
    checkNow: 'Check now',
    checking: 'Checking for updates …',
    upToDate: 'You have the latest version.',
    browserHint:
      'In the browser the app updates itself (a notice appears at the top after a new version has loaded).',
    channelDev: 'Dev preview (every state of develop)',
    devHelp:
      'Dev previews are untested in-between states. This app is separate from the stable Nemo app and has its own data: move data over with sync or a backup. A backup is made automatically before every update. The only way back to the stable version is to install the stable app.',
    devVersion: (version: string, sha: string) => `Dev preview ${version}${sha ? ` (${sha})` : ''}`,
  },
};
