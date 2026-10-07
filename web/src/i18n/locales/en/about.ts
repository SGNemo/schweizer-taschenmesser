import type { Strings } from '@/strings';

export const about: Strings['about'] = {
  title: 'About Nemo',
  tagline: 'Modular, local everyday app',
  version: 'Version',
  build: 'Build',
  commit: 'Commit',
  channel: 'Channel',
  channelStable: 'Stable',
  channelDev: 'Dev preview',
  platform: 'Platform',
  platforms: { web: 'Browser', desktop: 'Windows app', android: 'Android app' },
  install: 'Installation type',
  installKinds: {
    portable: 'Portable (folder with data)',
    installed: 'Installed',
    apk: 'Android app (APK)',
    pwa: 'Installed web app (PWA)',
    browser: 'Browser tab',
  },
  dataDir: 'Data folder',
  openDataDir: 'Open folder',
  openDataDirFailed: 'The folder could not be opened.',
  license: 'Licence',
  licenseValue: 'MIT Licence',
  updates: {
    title: 'Updates and changes',
    lastCheck: 'Last check',
    never: 'Never',
    browser: 'In the browser the app updates itself.',
    current: 'Changes in this version',
    available: (version: string) => `Changes in version ${version}`,
    none: 'There are no notes for this version.',
  },
  packages: 'Libraries used',
  links: {
    title: 'Links',
    open: 'Open',
    repo: 'Source code on GitHub',
    releases: 'Versions and downloads',
    docs: 'Documentation',
    bugs: 'Report a bug',
  },
  diagnostics: {
    title: 'Diagnostics',
    label: 'Export diagnostics',
    description:
      'Saves a file with version, platform, active modules and the latest error messages (shortened). Without entries, settings or keys.',
    saved: 'Diagnostics saved.',
  },
  reset: {
    title: 'Reset device',
    label: 'Delete all data on this device',
    description:
      'Deletes entries, settings and keys on this device. Data on the sync server and backup files stay.',
    dialogTitle: 'Delete all data on this device?',
    warning:
      'This can’t be undone. Make a backup first (Sync & backup) if you still need the data.',
    confirm: 'Delete for good',
  },
  licenses: 'Licence notices',
  licenseList: [
    'Font “Inter” – SIL Open Font License 1.1, © The Inter Project Authors.',
    'Wordmark “Nemo” (logo) in “Nunito” – SIL Open Font License 1.1, © The Nunito Project Authors.',
    'Icons “Lucide” – ISC Licence, © Lucide Contributors.',
    'The Nemo logo (clownfish) is an original drawing of this project.',
  ],
};
