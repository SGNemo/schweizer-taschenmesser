import type { Strings } from '@/strings';

export const device: Strings['device'] = {
  meta: {
    name: 'Device status',
    description:
      'Backup, sync, storage and updates of this device on one page. Display only, nothing leaves the device.',
  },
  summary: {
    ok: 'All good',
    look: (n: number) => `${n} things need a look`,
    settingsContext: 'Sync, backup, updates, storage',
  },
  page: {
    figureUnit: (n: number) => (n === 1 ? 'needs a look' : 'need a look'),
    note: 'Display only: every line leads to the settings, where it is changed.',
    pc: 'Processor, memory and network are shown by “This PC” on the tab “System”.',
    pcOpen: 'Open This PC',
    pcLibrary: 'Switch on “This PC” in the library',
  },
  groups: { backup: 'Backup', sync: 'Sync', storage: 'Storage', app: 'App' },
  nextBackup: {
    title: 'Next backup',
    plannedContext: 'Automatic, while Nemo is running',
    due: 'Due',
    dueContext: 'Runs the next time Nemo checks',
    off: 'Not planned',
    offContext: 'Automatic backups are off',
    manual: 'By hand',
    manualContext: 'In the browser you save a file whenever you like',
  },
  hub: {
    title: 'Home network',
    state: { listening: 'Active', off: 'Off', failed: 'Not reachable' },
    devices: (n: number) => (n === 1 ? '1 device paired' : `${n} devices paired`),
    offContext: 'This PC does not sync on the home network',
    failedContext: 'Switched on, but not listening right now',
  },
  drive: {
    title: 'Drive',
    free: (size: string) => `${size} free`,
    context: (size: string) => `of ${size} on the system drive`,
  },
  autostart: {
    title: 'Autostart',
    on: 'On',
    off: 'Off',
    onContext: 'Nemo starts with the PC',
    offContext: 'Nemo starts when you open it',
  },
  network: {
    title: 'Network',
    open: 'Allowed',
    blocked: 'Blocked',
    openContext: 'What went where is listed in the settings',
    blockedContext: 'Nemo sends nothing until you allow it again',
  },
  widget: {
    hint: (backup: string, sync: string) => `Backup: ${backup} · Sync: ${sync}`,
  },
};
