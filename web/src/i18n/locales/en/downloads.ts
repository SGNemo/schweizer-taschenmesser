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
    torrent: 'Switch the BitTorrent part on',
    torrentDht:
      'Find participants through the DHT network (needed for magnet links without a tracker)',
    torrentUpnp: 'Open the port on the router automatically (UPnP)',
    torrentUpKb: 'Torrent: upload limit (KB/s, 0 = unlimited)',
    torrentDownKb: 'Torrent: download limit (KB/s, 0 = unlimited)',
    seedRatio: 'Stop sharing at this ratio (0 = never)',
    seedMinutes: 'Stop sharing after this many minutes (0 = never)',
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
  torrent: {
    title: 'BitTorrent',
    intro:
      'Magnet links and .torrent files that you paste or open yourself. Nemo searches for nothing and recommends no sites.',
    hint: 'Only for legal content. While you download you upload at the same time.',
    off: {
      title: 'BitTorrent is off',
      body: 'The torrent part is switched off. A short notice comes first when you switch it on.',
      turnOn: 'Switch the torrent part on',
    },
    turnOff: 'Switch the torrent part off',
    starting: 'Starting …',
    startFailed: 'The torrent part could not start.',
    add: {
      button: 'Add a torrent',
      title: 'Add a torrent',
      magnet: 'Magnet link',
      magnetPlaceholder: 'magnet:?xt=urn:btih:…',
      or: 'or',
      openFile: 'Open a .torrent file',
      chosen: 'File chosen',
      look: 'Look at the files',
      looking: 'Looking for sources … this can take a moment.',
      files: 'Files',
      all: 'All',
      none: 'None',
      selected: 'Selected',
      pickOne: 'Choose at least one file.',
      submit: 'Download',
      back: 'Back',
    },
    errors: {
      off: 'The torrent part is off.',
      file: 'That is not a valid .torrent file (10 MB at most).',
      notMagnet: 'That is not a magnet link.',
      timeout: 'No sources found. Check the link or try again later.',
      alreadyAdded: 'This torrent is already in the list.',
      dir: 'The folder does not exist.',
      other: 'That did not work.',
    },
    state: {
      starting: 'Starting',
      downloading: 'Downloading',
      seeding: 'Sharing',
      paused: 'Paused',
      done: 'Done, sharing ended',
      error: 'Error',
    },
    row: {
      peers: (n: number) => (n === 1 ? '1 connection' : `${n} connections`),
      down: (speed: string) => `Down ${speed}/s`,
      up: (speed: string) => `Up ${speed}/s`,
      ratio: (ratio: string) => `Ratio ${ratio}`,
    },
    actions: {
      pause: 'Pause',
      resume: 'Resume',
      remove: 'Remove from list',
      removeData: 'Delete with files',
    },
    deleteData: {
      title: 'Delete the files?',
      body: (name: string) =>
        `“${name}” is deleted from the disk together with all downloaded files.`,
      confirm: 'Delete',
    },
    ip: {
      title: 'Your public IP address',
      note: 'While you download, other participants see your IP address. You can see it here too (one request to api.ipify.org, only on a click).',
      button: 'Show IP address',
      failed: 'The lookup did not work.',
    },
    empty: {
      title: 'No torrents yet',
      body: 'Add a magnet link or a .torrent file that you have yourself.',
    },
  },
};
