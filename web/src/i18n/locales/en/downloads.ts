import type { Strings } from '@/strings';

export const downloads: Strings['downloads'] = {
  meta: {
    name: 'Downloads',
    description:
      'Downloads files: progress, pause, resume, speed limit and checksum. Nothing is opened automatically.',
    widget: 'Running downloads',
    widgetEmpty: 'No downloads.',
    widgetAction: 'Add a download',
    widgetSummary: (running: number, waiting: number) =>
      waiting > 0
        ? `${running} running · ${waiting} waiting or paused`
        : running === 1
          ? '1 running'
          : `${running} running`,
  },
  settings: {
    limitKb: 'Speed limit for all downloads (KB/s, 0 = unlimited)',
    folder: 'Download folder (empty = the system Downloads folder)',
  },
  unsupported: {
    title: 'The download manager is only available in the desktop app',
    body: 'On this device your device’s browser downloads files.',
  },
  hint: 'Files only go to the chosen folder. Nemo never opens or starts them.',
  add: {
    button: 'Add a download',
    title: 'Add a download',
    url: 'Address (http:// or https://)',
    folder: 'Folder',
    pick: 'Choose folder',
    hash: 'Checksum (optional, SHA-256 or SHA-512)',
    hashHelp: 'The finished file is compared with it.',
    submit: 'Download',
    cancel: 'Cancel',
    http: 'This address is not encrypted (HTTP).',
  },
  errors: {
    scheme: 'Only addresses with http:// or https:// work.',
    url: 'That is not a valid address.',
    dir: 'The folder does not exist.',
    hash: 'The checksum needs 64 (SHA-256) or 128 (SHA-512) characters from 0–9 and a–f.',
    other: 'That did not work.',
  },
  state: {
    queued: 'Waiting',
    running: 'Downloading',
    paused: 'Paused',
    done: 'Done',
    failed: 'Failed',
  },
  failed: {
    http: 'The server did not deliver the file.',
    io: 'The file could not be written.',
    checksum: 'The checksum does not match. The file was deleted.',
    size: 'The file arrived incomplete.',
  },
  row: {
    progress: (done: string, total: string) => `${done} of ${total}`,
    unknownTotal: (done: string) => `${done} downloaded`,
    speed: (perSecond: string) => `${perSecond}/s`,
    limited: (perSecond: string) => `Limit ${perSecond}/s`,
  },
  actions: {
    pause: 'Pause',
    resume: 'Resume',
    retry: 'Try again',
    reveal: 'Show in folder',
    remove: 'Remove from list',
    removeData: 'Delete with file',
    more: 'More',
  },
  checksum: {
    label: 'SHA-256',
    verify: 'Compare checksum',
    verifyTitle: 'Compare checksum',
    field: 'Checksum (SHA-256 or SHA-512)',
    match: 'Matches',
    mismatch: 'Does not match',
    submit: 'Compare',
  },
  deleteData: {
    title: 'Delete the file?',
    body: (name: string) => `“${name}” is deleted from the disk, also an unfinished file.`,
    confirm: 'Delete',
  },
  empty: {
    title: 'No downloads yet',
    body: 'Paste an address or download something in the browser. Nothing is opened automatically.',
  },
};
