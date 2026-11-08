import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Move from another app',
  intro:
    'Bring your data from Google, Todoist, Notion, a banking app and more. Nemo recognises the files and shows a preview before anything is added; every move can be undone as a whole. Nothing leaves this device.',
  choose: 'Choose files',
  reading: (done: number, total: number) => `Reading files … ${done} of ${total}`,
  cancel: 'Cancel',
  parsing: 'Reading data …',
  detected: (apps: string) => `Recognised: ${apps}`,
  unknown: 'I can’t tell which app these files come from. Choose the source yourself:',
  manual: 'Choose another source',
  step: (i: number, n: number) => `Part ${i} of ${n}`,
  nothing: 'Nothing readable was found in the files.',
  vaultHint:
    'Passwords are imported in the vault, after you enter the master password. The CSV import opens there.',
  openVault: 'Go to the vault',
  paletteCommand: 'Import from another app …',
  start: 'Start moving',
  back: 'Back',
  privacy: 'The files are only read on this device. Nothing is uploaded.',
  whereTitle: 'Where are you coming from?',
  whereLead:
    'Where are you coming from? Choose the app your data comes from. Nemo recognises the rest from the files.',
  stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
  steps: {
    label: 'Steps',
    where: 'From',
    files: 'Files',
    check: 'Check',
  },
  origins: {
    google: {
      title: 'Google',
      how: 'At takeout.google.com choose Calendar, Contacts, Keep and Tasks and download the ZIP file. You can choose the ZIP as it is.',
    },
    apple: {
      title: 'Apple (iPhone, Mac)',
      how: 'Calendar: “Export” in the Calendar app (.ics). Contacts: export as vCard in the Contacts app.',
    },
    microsoft: {
      title: 'Microsoft (Outlook, To Do)',
      how: 'Microsoft To Do has no export of its own: in Outlook use “Export” → CSV → Tasks. Calendar as .ics, contacts as vCard.',
    },
    todoist: {
      title: 'Todoist',
      how: 'In Todoist download the backup as ZIP (Settings → Backups) or export a project as a CSV template.',
    },
    ticktick: {
      title: 'TickTick',
      how: 'In TickTick go to Settings → Account, “Generate backup” and save the CSV file.',
    },
    notion: {
      title: 'Notion',
      how: 'In Notion choose “Export” → “Markdown & CSV” and save the ZIP file.',
    },
    evernote: { title: 'Evernote', how: 'In Evernote export notebooks as an .enex file.' },
    obsidian: {
      title: 'Obsidian, Markdown',
      how: 'Choose the Markdown files or your Obsidian folder as a ZIP.',
    },
    bank: {
      title: 'Bank statement',
      how: 'In online banking download your transactions as CSV, CAMT, OFX or QIF.',
    },
    passwords: {
      title: 'Password manager',
      how: 'Export Bitwarden, 1Password or KeePass as CSV. The import then runs in the vault, with your master password.',
    },
    browser: {
      title: 'Browser bookmarks',
      how: 'Export your bookmarks as an HTML file in the browser (Chrome, Firefox, Edge, Safari, Brave).',
    },
    other: {
      title: 'I don’t know',
      how: 'Just choose the files. Nemo recognises where they come from.',
    },
  },
  foundTitle: 'Recognised',
  nothingTitle: 'Nothing recognised',
  pickSource: 'Choose the source yourself:',
  certainty: {
    sure: 'recognised for sure',
    likely: 'likely',
    maybe: 'maybe',
  },
  why: {
    'vault-csv':
      'The columns match a password manager. Only the rows are counted; the import runs in the vault.',
    ticktick: 'Header of a TickTick backup (List Name, Title, Kind).',
    todoist: 'Columns TYPE and CONTENT as in a Todoist export, one file per project.',
    'google-tasks': 'Tasks file from Google Takeout (“tasks#…”).',
    'outlook-tasks': 'Columns such as Subject and Due Date from an Outlook task export.',
    'google-keep': 'Keep notes from Google Takeout (JSON).',
    'google-calendar': 'Calendar file in iCalendar format.',
    enex: 'Evernote export (.enex).',
    notion: 'File names with the Notion id (title and 32 characters).',
    opml: 'OPML list of feed addresses.',
    contacts: 'Contact cards in vCard format. Contacts with a birthday are taken over.',
    bookmarks: 'Bookmarks file as every browser exports it.',
    obsidian: 'Markdown files; with an .obsidian folder certainly from Obsidian.',
    bank: 'Columns for date and amount, or a bank format (CAMT, OFX, QIF).',
  },
  units: {
    projects: (n: number) => n1(n, '1 project', `${n} projects`),
    lists: (n: number) => n1(n, '1 list', `${n} lists`),
    tasks: (n: number) => n1(n, '1 task', `${n} tasks`),
    notes: (n: number) => n1(n, '1 note', `${n} notes`),
    events: (n: number) => n1(n, '1 event', `${n} events`),
    contacts: (n: number) => n1(n, '1 contact', `${n} contacts`),
    bookmarks: (n: number) => n1(n, '1 bookmark', `${n} bookmarks`),
    transactions: (n: number) => n1(n, '1 transaction', `${n} transactions`),
    feeds: (n: number) => n1(n, '1 feed', `${n} feeds`),
    entries: (n: number) => n1(n, '1 entry', `${n} entries`),
  },
  goesTo: (module: string) => `Goes to: ${module}.`,
  openPreview: 'Open preview',
  runDone: (n: number) => n1(n, '1 entry was added.', `${n} entries were added.`),
  runParts: 'Added per area',
  runPart: (module: string, n: number) => `${module}: ${n}`,
  runUndoHint: '“Undo the whole move” takes back every part. What you changed since stays.',
  undoRun: 'Undo the whole move',
  undoRunShort: 'Undo',
  recentTitle: 'Recent moves',
  recentRun: (source: string, date: string) => `${source}, ${date}`,
  emptyTitle: 'No move yet',
  emptyText: 'Every move shows up here. You can take it back as a whole later.',
  checklist: 'Checklist',
  checklistHint: 'What is still missing for the move, step by step.',
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (Markdown & CSV export)',
    opml: 'OPML (feed and podcast apps)',
    obsidian: 'Obsidian or Markdown folder',
    'outlook-tasks': 'Microsoft To Do (Outlook CSV)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Calendar (.ics)',
    bank: 'Bank transactions (CSV, OFX, CAMT)',
    'vault-csv': 'Password manager (Bitwarden, KeePass, 1Password)',
    ticktick: 'TickTick (CSV backup)',
    contacts: 'Contacts (vCard: Google, Apple, Outlook)',
    bookmarks: 'Browser bookmarks (HTML)',
    strong: 'Strong (training, CSV)',
    hevy: 'Hevy (training, CSV)',
    cronometer: 'Cronometer (food, CSV)',
  },
  reasons: {
    trashed: (n: number) =>
      n1(
        n,
        '1 entry from the trash or archive was left out.',
        `${n} entries from the trash or archive were left out.`,
      ),
    empty: (n: number) => n1(n, '1 empty entry was skipped.', `${n} empty entries were skipped.`),
    unreadable: (n: number) =>
      n1(
        n,
        '1 file is unreadable or from another app and was skipped.',
        `${n} files are unreadable or from another app and were skipped.`,
      ),
    attachment: (n: number) =>
      n1(
        n,
        '1 attachment (image or file) was not imported: notes store text only.',
        `${n} attachments (images or files) were not imported: notes store text only.`,
      ),
    unsupported: (n: number) =>
      n1(n, '1 entry is not supported.', `${n} entries are not supported.`),
    tooMany: (n: number) => `The preview shows at most ${n} entries; the rest was left out.`,
    done: (n: number) =>
      n1(n, '1 completed entry was left out.', `${n} completed entries were left out.`),
  },
  report: {
    title: 'Report',
    imported: (n: number) => n1(n, '1 entry imported.', `${n} entries imported.`),
    duplicates: (n: number) => n1(n, '1 was already there.', `${n} were already there.`),
    invalid: (n: number) =>
      n1(
        n,
        '1 did not fit the format and was not saved.',
        `${n} did not fit the format and were not saved.`,
      ),
    deselected: (n: number) => n1(n, 'You unticked 1.', `You unticked ${n}.`),
  },
  newNotebook: 'New notebook',
};
