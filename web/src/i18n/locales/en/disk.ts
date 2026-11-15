import { formatNumber } from '@/core/i18n/format';
import type { Strings } from '@/strings';

export const disk: Strings['disk'] = {
  meta: {
    name: 'This PC',
    description:
      'Drives with a scan of the biggest folders, tidy-up suggestions and system info – PC only. Only what you confirm is deleted.',
    route: 'This PC',
    route2: 'Disk scan',
    widget: 'Drives',
    widget2: 'System',
  },
  title: 'This PC',
  tabsLabel: 'Section',
  tabs: {
    drives: 'Drives',
    tidy: 'Tidy up',
    startup: 'Startup',
    tweaks: 'Windows settings',
    system: 'System',
    history: 'History',
  } as const,
  lead: 'What’s using the space? Scan a drive and explore the biggest folders. Nothing is changed or uploaded.',
  loading: 'Reading drives …',
  empty: 'No drives were found.',
  failedDrives: 'The drives couldn’t be read.',
  kind: {
    ssd: 'SSD',
    hdd: 'Hard drive (HDD)',
    fixed: 'Hard drive',
    removable: 'Removable drive / USB',
    network: 'Network drive',
    ram: 'RAM disk',
    unknown: 'Drive',
  },
  driveName: (root: string, label: string) => (label ? `${root} (${label})` : root),
  open: (name: string) => `Scan ${name}`,
  usedOf: (used: string, total: string) => `${used} of ${total} used`,
  free: (free: string) => `${free} free`,
  /** Module head (identity v3.1 G01): figure of the system drive, its state as a word, the drive rings. */
  head: {
    used: 'used',
    of: (total: string) => `of ${total}`,
    state: { ok: '', tight: 'getting tight', full: 'almost full' } as Record<string, string>,
    lastScan: (when: string) => `last scanned: ${when}`,
    neverScanned: 'not scanned yet',
  },
  card: {
    scan: 'Scan',
    systemDrive: 'System drive',
    type: {
      nvme: 'NVMe SSD',
      ssd: 'SSD',
      hdd: 'Hard drive (HDD)',
      usb: 'USB drive',
      network: 'Network drive',
      removable: 'Removable drive',
      ram: 'RAM disk',
      drive: 'Drive',
    } as Record<string, string>,
    advice: {
      ok: 'Plenty of space.',
      tight: 'Getting tight – tidy up soon.',
      full: 'Almost full – tidying up recommended.',
    } as Record<string, string>,
    healthLabel: 'Health',
    toTidy: 'Open Tidy up',
    trimLabel: 'TRIM',
    trim: {
      on: 'Switched on in Windows',
      off: 'Switched off in Windows. Switching it on takes administrator rights in Windows; Nemo doesn’t change it.',
    } as Record<string, string>,
    helpTrim:
      'With TRIM, Windows tells an SSD which areas are free after deleting. Without TRIM an SSD can get slower at writing over time.',
    health: {
      ok: 'Fine',
      warning: 'The drive reports problems – back up your data.',
      needsAdmin: 'not available – Windows only gives this value with administrator rights',
      unsupported: 'not available – this drive doesn’t report it',
    } as Record<string, string>,
    temperature: (c: number) => `${c} °C`,
    helpSmart:
      'SMART is the self-test that modern drives report on their own. Nemo only reads what Windows gives out without administrator rights – often just the temperature.',
    lastScan: (when: string) => `Last scanned: ${when}`,
    neverScanned: 'Not scanned yet',
    growth: (delta: string) => `Used since last scan: ${delta}`,
    history: 'Used space since app start',
    historyHint: 'History since app start – it isn’t saved.',
    io: (read: string, write: string) => `Read ${read} · Write ${write}`,
    model: 'Model',
    details: 'Details',
    temperatureLabel: 'Temperature',
    ioLabel: 'Activity',
  },
  quick: {
    biggest: 'Biggest folders in the last scan',
    biggestHint: 'From this session’s scan.',
  },
  actions: {
    reveal: 'Show in Explorer',
    copyPath: 'Copy path',
    copied: 'Path copied.',
    addBasket: 'Add to basket',
    inBasket: 'In basket',
    remove: 'Remove from basket',
    delete: 'Delete …',
    protectedTitle: 'Protected',
    protectedText: (reason: string) => `This entry can’t be deleted here: ${reason}`,
    heading: 'Actions',
  },
  deny: {
    missing: 'It’s no longer there or no longer readable.',
    'drive-root': 'Drive roots are never deleted.',
    'system-folder': 'It belongs to Windows or to installed programs.',
    'user-profile': 'It’s a user folder (profile). Open it and choose individual folders inside.',
    'app-data': 'The “AppData” folder and its main folders belong to programs.',
    'system-file': 'It’s a system file (page file, hibernation).',
    'own-app': 'It belongs to this app (program or data) or contains it.',
    'running-program': 'A program that’s currently running is inside it.',
    'scan-root': 'The scanned folder itself can’t be deleted.',
    'not-an-entry': 'Grouped small files aren’t a single entry.',
  },
  basket: {
    title: 'Selection basket',
    empty: 'Nothing collected yet. Add entries with “Add to basket” and delete them together.',
    total: (n: number, size: string) => `${n === 1 ? '1 entry' : `${n} entries`}, ${size} in total`,
    clear: 'Empty basket',
    deleteAll: 'Delete all …',
    remove: (name: string) => `Remove ${name} from basket`,
    added: (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'} in the basket`,
  },
  del: {
    title: 'Confirm deletion',
    titleDone: 'Result',
    planning: 'Checking the selection …',
    planFailed: 'The selection couldn’t be checked.',
    nothing: 'None of this can be deleted.',
    items: 'This will be deleted',
    total: (n: number, size: string, files: string) =>
      `${n === 1 ? '1 entry' : `${n} entries`} · ${size} · ${files} files`,
    modeLabel: 'Where should it go?',
    modeTrash: 'Move to recycle bin (recommended)',
    modePermanent: 'Delete permanently – without recycle bin',
    trashBtn: 'Move to recycle bin',
    permBtn: 'Delete permanently',
    twiceHint: 'Because this is a lot or permanent, Nemo asks once more.',
    againTitle: 'Really delete?',
    againTrash: (n: number, size: string, files: string) =>
      `${n === 1 ? '1 entry' : `${n} entries`} with ${size} (${files} files) will go to the recycle bin.`,
    againPermanent: (n: number, size: string, files: string) =>
      `${n === 1 ? '1 entry' : `${n} entries`} with ${size} (${files} files) will be deleted permanently. This can’t be undone.`,
    againYesTrash: 'Yes, move to recycle bin',
    againYesPermanent: 'Yes, delete permanently',
    back: 'Back',
    warnUser:
      'This is in your personal folders (Documents, Pictures, Desktop, Videos, Music). Check carefully that you really don’t need it any more.',
    warnProgram: 'This looks like a program (executable files). The program won’t work afterwards.',
    warnLarge: (files: string, size: string) => `Very large deletion: ${files} files, ${size}.`,
    warnNoBin:
      'Network and removable drives often have no recycle bin. Then nothing is deleted, and you can choose “permanently” on purpose afterwards.',
    warnPermanent: 'Permanently means: gone, without recycle bin. This can’t be undone.',
    notDeletable: 'Can’t be deleted (stays untouched)',
    running: 'Deleting …',
    progress: (done: number, total: number, files: string) =>
      `Entry ${Math.min(done + 1, total)} of ${total} · ${files} files deleted`,
    cancel: 'Cancel',
    stop: 'Stop',
    close: 'Close',
    errors: {
      'confirmation-missing': 'The second confirmation is missing. Please delete again.',
      'plan-expired': 'The check has expired. Please start deleting again.',
      'unknown-plan': 'The check has expired. Please start deleting again.',
      'already-running': 'A deletion is already running.',
      generic: 'Deleting couldn’t be started.',
    } as Record<string, string>,
    report: {
      freed: (size: string) => `${size} of space freed`,
      files: (n: string) => `${n} files removed`,
      cancelled: 'Deleting was cancelled. Anything not yet reached stays untouched.',
      toBin: 'The entries are now in the recycle bin and can be restored from there.',
      permanent: 'The entries have been permanently deleted.',
      outcome: {
        deleted: 'Deleted',
        partial: 'Partly deleted',
        failed: 'Not deleted',
        skipped: 'Skipped',
        trashUnavailable: 'Recycle bin not possible – nothing deleted',
        cancelled: 'Cancelled',
      },
      reason: {
        'in-use': 'File in use',
        denied: 'Access denied',
        other: 'Unknown error',
        changed: 'Changed since the scan',
      } as Record<string, string>,
      moreErrors: (n: number) => `… and ${n} more ${n === 1 ? 'error' : 'errors'}`,
      permanentInstead: 'Delete these permanently …',
      partialHint: 'This folder’s numbers may now be off. Scan it again if needed.',
    },
  },
  dupes: {
    title: 'Duplicate files',
    search: 'Find duplicate files',
    searching: 'Searching …',
    stop: 'Stop search',
    hint: 'Files of 1 MB or more in this folder are compared: first the size, then a part, then the whole content. Nothing is ever deleted automatically.',
    none: 'No duplicate files found.',
    failed: 'The search was cancelled or failed.',
    group: (n: number, size: string, wasted: string) =>
      `${n} identical files of ${size} each – ${wasted} can be saved`,
    keepOne: 'At least one file stays.',
    select: (name: string) => `Add ${name} to basket`,
  },
  map: {
    label: (name: string, n: number) =>
      `Map view of the folder ${name || 'Drive'} with ${n === 1 ? '1 entry' : `${n} entries`}. Arrow keys select, Enter opens a folder, Backspace goes up one level.`,
    help: 'Each area is a folder or file; its size shows the space used. Click a folder to open it, Shift+click only selects it. The list has the same details as text.',
    empty: 'Nothing in this folder takes up space.',
    legend: 'Legend',
    byType: 'File type',
    byDepth: 'Depth',
    ageLegendUse:
      'Colour = last use (opened or changed, whichever is newer). For folders the most recently used file inside counts: a red folder has not been opened for years.',
    depthLegend: 'The darker the area, the deeper the folder.',
    byAge: 'Age',
    ageLegend:
      'Colour = last change. For folders the newest file inside counts: a red folder hasn’t been touched for years.',
    colorBy: 'Colour by',
    kind: {
      video: 'Videos',
      image: 'Pictures',
      audio: 'Music',
      archive: 'Archives',
      program: 'Programs',
      document: 'Documents',
      game: 'Game data',
      other: 'Other',
    },
  },
  age: {
    buckets: [
      'under 1 month',
      '1–6 months',
      '6–12 months',
      '1–2 years',
      '2–3 years',
      'over 3 years',
    ] as readonly string[],
    ago: (days: number) => {
      if (days < 1) return 'today';
      if (days < 2) return 'yesterday';
      if (days < 14) return `${Math.floor(days)} days ago`;
      if (days < 61) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 730) return `${Math.floor(days / 30.44)} months ago`;
      return `${Math.floor(days / 365.25)} years ago`;
    },
    short: (days: number) => {
      if (days < 1) return 'today';
      if (days < 14) return `${Math.floor(days)} d`;
      if (days < 61) return `${Math.floor(days / 7)} wk`;
      if (days < 730) return `${Math.floor(days / 30.44)} mo`;
      return `${Math.floor(days / 365.25)} yr`;
    },
  },
  select: {
    label: 'Selected results',
    row: (name: string) => `Select ${name}`,
    all: 'Select all results',
    summary: (n: number, size: string) =>
      `${n} ${n === 1 ? 'entry' : 'entries'} selected · ${size}`,
    toBasket: 'Add to basket',
    delete: 'Delete selection …',
    clear: 'Clear selection',
  },
  views: { label: 'View', map: 'Map', list: 'List' },
  nav: {
    path: 'Path',
    up: 'Up one level',
    open: 'Open',
    root: (root: string) => root,
  },
  filter: {
    label: 'Quick filter',
    none: 'All',
    topDirs: 'Biggest folders',
    topFiles: 'Biggest files',
    old: 'Not changed for a long time',
    unused: 'Not used for a long time',
    oldSince: 'Not changed for',
    months: (n: number) =>
      n % 12 === 0 ? (n === 12 ? '1 year' : `${n / 12} years`) : `${n} months`,
    all: 'Everything',
    topmost: 'Show old folders only once (without their contents)',
    minSize: 'Minimum size',
    anySize: 'any size',
    fromSize: (size: string) => `from ${size}`,
    oldSummary: (n: number, size: string, since: string) =>
      `${n} ${n === 1 ? 'entry' : 'entries'} with ${size} in total, not changed for over ${since}`,
    capped: (n: number) => `Showing the ${n} biggest.`,
    basis: 'Based on',
    byChange: 'last change',
    byOpen: 'last opened',
    notOpenedSince: 'Not opened for',
    oldSummaryOpened: (n: number, size: string, since: string) =>
      `${n} ${n === 1 ? 'entry' : 'entries'} with ${size} in total, not opened for over ${since}`,
    accessHelp:
      'On this drive Windows keeps track of when files were last opened (to within about an hour). Virus scanners, thumbnails or backups can set the date too; then a file looks newer than it is, never older.',
    oldHelp:
      'This counts the last change, not the last time something was opened: Windows usually doesn’t keep track of opening files reliably. For folders the newest file inside counts. For games an update resets the date, playing alone doesn’t.',
    type: 'File type',
    scope: 'Show',
    dirs: 'Folders',
    files: 'Files',
    empty: 'Empty folders',
    dupes: 'Duplicate files',
    inFolder: (name: string) => `Inside ${name}`,
    none_found: 'No results.',
    results: (n: number) => (n === 1 ? '1 result' : `${n} results`),
  },
  games: {
    filter: 'Games (Steam)',
    label: 'Steam games',
    lastPlayed: 'Last played',
    played: (date: string, ago: string) => `Last played on ${date} · ${ago}`,
    unknown: 'No play date from Steam',
    summary: (n: number, size: string, idle: number) =>
      `${n} ${n === 1 ? 'game' : 'games'} with ${size} in total, ${idle} of them not played for over a year`,
    help: 'The date comes from Steam’s own files and counts the last time you played, not the last update. If it is missing, the game was never started or Steam did not record it. The cleanest way to uninstall a game is in Steam itself: if only the folder is deleted, Steam still shows it as installed.',
  },
  list: {
    name: 'Name',
    size: 'Used',
    share: 'Share',
    files: 'Files',
    modified: 'Modified',
    accessed: 'Opened',
    sortBy: (col: string) => `Sort by ${col}`,
    in: 'In',
    empty: 'No entries.',
    label: 'Folder entries',
  },
  details: {
    title: 'Details',
    folder: 'Folder',
    file: 'File',
    aggregate: 'Smaller files (grouped)',
    path: 'Path',
    used: 'Used (on disk)',
    fileSize: 'File size',
    shareOfFolder: (name: string) => `Share of ${name || 'Drive'}`,
    files: 'Files',
    modified: 'Last modified',
    modifiedFolder: 'Last modified (newest file inside)',
    accessed: 'Last opened',
    accessedFolder: 'Last opened (newest file inside)',
    types: 'File types',
    ages: 'Age of the data',
    ageBar: 'Shares by age',
    oldShare: (size: string, pct: number) => `${size} (${pct}%) not changed for over a year`,
    unusedShare: (size: string, pct: number) => `${size} (${pct} %) not used for over a year`,
    showOld: 'Show old entries here',
    biggest: 'Biggest entries here',
    open: 'Open folder',
    percent: (p: number) => `${p}%`,
  },
  scan: {
    back: 'Back to drives',
    title: (root: string) => `Scan of ${root}`,
    scanning: 'Scan running',
    paused: 'Scan paused',
    runningOf: (root: string) => `Scan of ${root} running`,
    pausedOf: (root: string) => `Scan of ${root} paused`,
    soFar: (files: string, size: string) => `${files} files, ${size} so far`,
    toScan: 'Open the scan',
    liveList: 'Folders so far',
    pendingShort: 'still counting',
    pendingNote: 'Still being counted',
    pendingLegend: '… = still being counted',
    pendingCount: (n: number) =>
      n === 1 ? '1 entry is still being counted.' : `${n} entries are still being counted.`,
    endedOf: (root: string) => `Scan of ${root} finished`,
    cancelledOf: (root: string) => `Scan of ${root} cancelled`,
    endedShort: 'Scan finished',
    cancelledShort: 'Scan cancelled',
    liveMapLabel: (n: number) =>
      n === 1
        ? 'Map of the running scan with 1 entry.'
        : `Map of the running scan with ${n} entries.`,
    failedOf: (root: string) => `Scan of ${root} failed`,
    toResult: 'Open the result',
    alreadyRunning: 'A scan is already running – end it to start another one.',
    liveLabel: 'Live view of the scan',
    liveHint:
      'The picture fills up while counting. Opening, selecting and deleting work once the scan is done.',
    liveEmpty: 'Counting the first folders …',
    files: 'Files',
    folders: 'Folders',
    cancel: 'Cancel',
    pause: 'Pause',
    resume: 'Resume',
    cancelled: 'The scan was cancelled. The result is incomplete.',
    failed: (reason: string) =>
      reason === 'not-found'
        ? 'The drive or folder wasn’t found.'
        : reason === 'denied'
          ? 'Access to this drive was denied.'
          : 'The scan failed.',
    done: 'Scan finished',
    totalUsed: 'Used (on disk)',
    sizeHelp:
      'Space used on disk: each file counts in whole allocation units (clusters), so the value is slightly above the pure file size. Online-only cloud files don’t count.',
    fileSize: 'Total file size',
    cloud: (size: string) => `${size} is online only (cloud) and takes no space here.`,
    links: (n: number) =>
      n === 1
        ? '1 shortcut or online folder was not entered (no double counting).'
        : `${n} shortcuts or online folders were not entered (no double counting).`,
    duration: (s: string) => `Duration: ${s}`,
    notRead: 'Not read (access denied)',
    notReadHint:
      'These folders couldn’t be read without administrator rights. They’re missing from the total.',
    notReadMore: (n: number) => `… and ${n} more`,
    reason: {
      denied: 'access denied',
      vanished: 'deleted since',
      'too-deep': 'nested too deeply',
      error: 'not readable',
    },
    smallFiles: (n: number) => (n === 1 ? '1 smaller file' : `${n} smaller files`),
  },
  tidy: {
    lead: 'Nemo looks in well-known places for things that can usually go. You see what it is beforehand; only what you confirm is deleted – to the recycle bin by default.',
    search: 'Search',
    again: 'Search again',
    cancel: 'Cancel',
    searching: 'Searching …',
    searchingStep: (done: number, total: number, what: string) =>
      `Searching … ${done} of ${total}: ${what}`,
    failed: 'The search didn’t work. You can try again.',
    none: 'Nothing to tidy up.',
    noneHint:
      'There’s hardly anything in the well-known places right now. Duplicates and large files you haven’t used for a long time are in a drive’s scan.',
    toDrives: 'Go to drives',
    cancelledNote: 'The search was cancelled. The list may be incomplete.',
    summary: (n: number, size: string) =>
      `${n === 1 ? '1 suggestion' : `${formatNumber(n)} suggestions`} · ${size} in total`,
    listLabel: 'Suggestions',
    category: {
      temp: 'Temporary files',
      browserCache: 'Browser cache',
      crashReports: 'Crash reports',
      oldDownloads: 'Old downloads',
    } as Record<string, string>,
    source: { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', firefox: 'Firefox' } as Record<
      string,
      string
    >,
    placeName: (category: string, source: string) =>
      source ? `${category} (${source})` : category,
    what: {
      temp: 'Leftovers of programs and installers. Files from the last 7 days stay, because a program may still need them.',
      browserCache:
        'Copies of web pages so they load faster. The browser recreates them when needed; bookmarks, history and sign-ins stay.',
      crashReports:
        'Reports and memory dumps of crashed programs. You only need them when someone looks into a crash.',
      oldDownloads:
        'Files in Downloads that haven’t changed for at least 90 days. These are your own files: choose yourself.',
    } as Record<string, string>,
    busy: (program: string) =>
      `${program} is running. Close it first, otherwise some files will be left behind.`,
    preview: (n: number) => `Preview · ${n === 1 ? '1 entry' : `${formatNumber(n)} entries`}`,
    selectItem: (name: string) => `Select ${name}`,
    rest: (n: number, size: string) =>
      `${n === 1 ? '1 more, smaller entry' : `${formatNumber(n)} more, smaller entries`} · ${size}`,
    all: 'Select all',
    noneSelected: 'Clear selection',
    selected: (size: string) => `Selected: ${size}`,
    nothingSelected: 'Nothing selected',
    clean: 'Tidy up …',
    cleanLabel: (name: string) => `Tidy up: ${name}`,
    look: 'View in scan',
    lookLabel: (name: string) => `View in scan: ${name}`,
    changed: (when: string) => `changed ${when}`,
    windows: {
      title: 'Windows does this itself',
      lead: 'Some things are tidied up most safely by Windows itself. Nemo opens the right place for you.',
      recycle: 'Recycle bin',
      recycleHint:
        'What Nemo tidies up lands here. In the recycle bin you can restore it or empty it for good.',
      recycleOpen: 'Open recycle bin',
      updates: 'Update leftovers and system files',
      updatesHint: 'Windows removes old update files under Settings → System → Storage.',
      updatesOpen: 'Open storage settings',
      openFailed: 'That couldn’t be opened.',
    },
    pointer: 'Temporary files, browser caches and old downloads are under “Tidy up”.',
  },
  history: {
    lead: 'What Nemo changed on this PC, with the way back. What you tidy up is listed until you close Nemo; changes to startup programs and Windows settings stay listed.',
    loading: 'Reading history …',
    empty: 'The history is still empty.',
    emptyHint: 'As soon as you tidy something up or switch something, it’s listed here.',
    reload: 'Load again',
    failed: 'The history couldn’t be read.',
    recovered: 'The history file was damaged and has been started anew. Older entries are missing.',
    unreadable:
      'The file with the stored changes can’t be read right now. Until then Nemo changes nothing; try again later.',
    listLabel: 'History',
    fromScan: 'From the scan',
    trashed: (what: string, size: string, files: number) =>
      `${what}: ${size} to the recycle bin · ${files === 1 ? '1 file' : `${formatNumber(files)} files`}`,
    deleted: (what: string, size: string, files: number) =>
      `${what}: ${size} deleted permanently · ${files === 1 ? '1 file' : `${formatNumber(files)} files`}`,
    restore: 'Open recycle bin',
    restoreHint: 'As long as they are in the recycle bin, you can restore the files there.',
    restoreLabel: (what: string) => `Open recycle bin: ${what}`,
    noWayBack: 'Deleted permanently – this can’t be brought back.',
    switched: (name: string, on: boolean) => `${name}: ${on ? 'switched on' : 'switched off'}`,
    undo: 'Undo',
    undoLabel: (what: string) => `Undo: ${what}`,
    undoDone: 'Put back.',
    undoFailed: 'That couldn’t be put back.',
    changedElsewhere: 'This was changed in Windows in the meantime, so Nemo leaves it as it is.',
    undone: 'Taken back.',
    canUndo: 'The value from before is stored.',
    undoNewerFirst: 'Take back the newer change to it first.',
    stale: 'Changed in Windows in the meantime.',
    changed: (name: string) => `${name}: changed`,
    chose: (name: string, choice: string) => `${name}: ${choice}`,
  },
  tweaks: {
    lead: 'These are settings of Windows. You can switch them here without looking for them in Windows. Every change can be taken back.',
    onlyWindows: 'These settings exist on Windows only.',
    onlyWindowsHint: 'Nemo changes nothing here on this device.',
    loading: 'Reading settings …',
    failed: 'The settings couldn’t be read.',
    again: 'Read again',
    none: 'There is nothing to set here on this PC.',
    changedCount: (n: number) =>
      n === 1 ? '1 setting changed by Nemo.' : `${n} settings changed by Nemo.`,
    resetAll: 'Reset all',
    resetTitle: 'Reset all?',
    resetText: 'These settings get back the value they had before your first change here:',
    resetConfirm: 'Reset',
    cancel: 'Cancel',
    resetDone: (names: string) => `Reset: ${names}.`,
    resetKept: (names: string) => `Left unchanged: ${names}.`,
    resetLeft: (name: string) => `${name} (changed in Windows in the meantime)`,
    applyLocked: 'This plan is already active.',
    noPlan: 'No plan recognised',
    resetFailed: (name: string) => `${name} (couldn’t be reset)`,
    resetNothing: 'There was nothing to reset.',
    restorePoint: 'Open System Protection',
    restorePointHint: 'If you like, create a restore point there first. It isn’t required.',
    group: {
      appearance: 'Appearance',
      explorer: 'Explorer',
      privacy: 'Privacy',
      power: 'Power',
    } as Record<string, string>,
    title: {
      animations: 'Animations in windows',
      dragFullWindows: 'Window contents while dragging',
      pointerSonar: 'Show the pointer with Ctrl',
      fileExtensions: 'Show file extensions',
      hiddenFiles: 'Show hidden files',
      advertisingId: 'Advertising ID for apps',
      trackAppLaunches: 'Remember app launches for Start and search',
      powerPlan: 'Power plan',
    } as Record<string, string>,
    what: {
      animations: 'Controls inside windows fade in and out. Switched off, they appear at once.',
      dragFullWindows:
        'You see the whole window while you move it. Switched off, Windows shows only an outline.',
      pointerSonar: 'Pressing the Ctrl key shows with circles where the pointer is.',
      fileExtensions:
        'Explorer shows extensions such as .pdf or .exe after the file name, so you see what kind of file it is.',
      hiddenFiles:
        'Explorer also shows files and folders that are marked as hidden. Protected system files stay hidden.',
      advertisingId:
        'Apps may use your advertising ID to tailor ads to you. Switched off, you don’t see fewer ads, but they no longer follow this ID.',
      trackAppLaunches:
        'Windows remembers which apps you start and uses that to sort the Start menu and search.',
      powerPlan:
        'Decides how Windows balances performance and power use. The plan applies to all accounts of this PC. You can choose only among the plans it already has.',
    } as Record<string, string>,
    detail: {
      animations:
        'In Windows it is part of the “Animation effects” switch under Accessibility → Visual effects. The switch there may cover more than this one setting.',
      dragFullWindows:
        'Windows calls it “Show window contents while dragging” (Performance Options → Visual Effects). Nemo switches it the same way Windows itself does.',
      pointerSonar:
        'Windows calls it “Show location of pointer when I press the CTRL key” (Mouse Properties → Pointer Options). Nemo switches it the same way Windows itself does.',
      fileExtensions:
        'Explorer calls it “File name extensions” (View → Show). Nemo switches it the same way Windows itself does.',
      hiddenFiles:
        'Explorer calls it “Hidden items” (View → Show). Nemo switches it the same way Windows itself does.',
      advertisingId:
        'In Windows it is under Privacy & security → General. Nemo changes the same entry as the switch there; it applies to your account only.',
      trackAppLaunches:
        'In Windows it is under Privacy & security → General. Nemo changes the same entry as the switch there; it applies to your account only.',
      powerPlan:
        'In Windows the plans are in Control Panel under Power Options. Nemo only switches between them, creates no new plan and unhides none.',
    } as Record<string, string>,
    riskLow: 'Risk: low.',
    riskNote: {
      hiddenFiles:
        'Hidden files often belong to programs. Once visible, they are easier to move or delete by accident.',
      trackAppLaunches: 'Switched off, the “Most used” list in the Start menu stays empty.',
      powerPlan:
        'A plan with more performance uses more power; on a laptop the battery doesn’t last as long.',
    } as Record<string, string>,
    refresh: {
      explorer: 'Open Explorer windows show it after a refresh (F5).',
    },
    more: 'More about this',
    moreLabel: (title: string) => `More about this: ${title}`,
    source: 'Source: Microsoft documentation',
    sourceLabel: (title: string) =>
      `Source: Microsoft documentation (${title}, opens in the browser)`,
    changedHere: 'changed by Nemo',
    stateOn: 'Switched on',
    stateOff: 'Switched off',
    stateChoice: (label: string) => (label ? `Active: ${label}` : ''),
    windowsDefault: 'Nothing is set here; Windows’ default applies.',
    customValue:
      'Another value is stored here that Nemo can’t place. After a change, Undo puts exactly this value back.',
    unreadable:
      'Nemo can’t read the current value. Without it there would be no way back, so Nemo changes nothing here.',
    turnOn: 'Switch on',
    turnOff: 'Switch off',
    turnOnLabel: (title: string) => `Switch on: ${title}`,
    turnOffLabel: (title: string) => `Switch off: ${title}`,
    apply: 'Apply',
    applyLabel: (title: string) => `Apply: ${title}`,
    chooseLabel: (title: string) => `Choose ${title}`,
    switched: (title: string, on: boolean) => `${title}: ${on ? 'switched on' : 'switched off'}.`,
    chosen: (title: string, label: string) => `${title}: ${label}.`,
    setFailed: 'That couldn’t be changed. Nothing was changed.',
  },
  startup: {
    lead: 'This is what starts with Windows through its startup list. Switch off what you don’t need at start-up – the program stays installed and can be switched on again.',
    loading: 'Reading startup programs …',
    failed: 'The startup programs couldn’t be read.',
    again: 'Try again',
    onlyWindows: 'Nemo shows startup programs on Windows only.',
    empty: 'Nemo finds no programs in Windows’ startup list.',
    user: 'For your account',
    machine: 'For all accounts',
    count: (on: number, total: number) => `${on} of ${total} switched on`,
    machineHint:
      'View only: these entries apply to everyone who uses this PC. They can be changed in Windows’ settings with an administrator account.',
    machineOpen: 'Change in Windows settings',
    openFailed: 'That couldn’t be opened.',
    switchLabel: (name: string) => `Start ${name} with Windows`,
    notSwitchable: 'Can’t be switched here',
    on: 'Switched on',
    off: 'Switched off',
    folder: 'Startup folder',
    nowOff: (name: string) => `${name} no longer starts with Windows.`,
    nowOn: (name: string) => `${name} starts with Windows again.`,
    undo: 'Undo',
    undoFailed: 'That couldn’t be put back. The history shows the current state.',
    setFailed: 'That couldn’t be switched.',
    impact:
      'Windows rates how much a program slows down start-up itself: Task Manager shows it under “Startup apps” in the column “Startup impact”.',
    historyOff: (name: string) => `${name}: no longer starts with Windows`,
    historyOn: (name: string) => `${name}: starts with Windows again`,
  },
  advice: {
    title: 'Drive health',
    health: (drive: string) =>
      `${drive} reports problems. It’s best to back up the data on it soon.`,
  },
};
