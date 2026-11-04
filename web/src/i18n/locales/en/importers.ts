import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Import from another app',
  intro:
    'Choose the file(s) of your export, ZIP files too. Nemo recognises which app they come from and shows a preview before anything is added. Nothing leaves this device.',
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
  sources: {
    enex: 'Evernote (.enex)',
    obsidian: 'Obsidian or Markdown folder',
    'outlook-tasks': 'Microsoft To Do (Outlook CSV)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Calendar (.ics)',
    bank: 'Bank transactions (CSV, OFX, CAMT)',
    'vault-csv': 'Password manager (Bitwarden, KeePass, 1Password)',
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
