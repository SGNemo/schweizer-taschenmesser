import type { Strings } from '@/strings';

export const backup: Strings['backup'] = {
  deletedCount: (n: number) => ` (+${n} deleted)`,
  title: 'Backup',
  intro:
    'Save all your data as a file or restore a backup. Credentials (sync token, keys) are never included in a backup.',
  export: 'Download backup',
  exported: 'Backup downloaded.',
  file: 'Backup file',
  mode: 'Restore',
  merge: 'Merge',
  mergeHint: 'Nothing is lost; in a conflict, the newer change wins.',
  replace: 'Replace',
  replaceHint: 'The backup becomes the current state: entries not in the backup are deleted.',
  doImport: 'Import',
  contains: (records: number, tables: number) =>
    `${records} ${records === 1 ? 'entry' : 'entries'} in ${tables} ${tables === 1 ? 'table' : 'tables'}`,
  confirmTitle: 'Replace with backup?',
  confirmText:
    'All entries not in the backup will be deleted – on other devices too, as soon as they sync.',
  done: (records: number, removed: number) =>
    removed > 0
      ? `${records} ${records === 1 ? 'entry' : 'entries'} restored, ${removed} removed.`
      : `${records} ${records === 1 ? 'entry' : 'entries'} restored.`,
  encryptedExport: 'Export encrypted',
  encryptedExported: 'Encrypted backup downloaded.',
  exportHint:
    'Recommended: export encrypted (Argon2id, AES-256). The normal backup holds all entries in plain text.',
  exportPassphrase: 'Password for the backup',
  exportPassphraseHint:
    'At least 8 characters. Without this password the backup can’t be opened – there is no reset.',
  passphraseTooShort: 'The password needs at least 8 characters.',
  openPassphrase: 'Backup password',
  unlock: 'Open',
  verify: 'Check backup',
  verifyHint:
    'Checks the file and does a trial restore into a temporary database. Your data stays untouched.',
  verifying: 'Checking …',
  verifyOk: 'The backup is fine and can be restored.',
  verifyFailed: 'The backup is not OK.',
  verifyExported: (when: string) => `Created on ${when}`,
  verifyTotals: (records: number, tombstones: number) =>
    `${records} ${records === 1 ? 'entry' : 'entries'}, ${tombstones} deletion ${tombstones === 1 ? 'marker' : 'markers'}`,
  skippedOnRestore: (n: number) =>
    n === 1
      ? '1 table in the file is no longer known to this app version (e.g. old modules like shopping, packing lists or habits) and won’t be restored.'
      : `${n} tables in the file are no longer known to this app version (e.g. old modules like shopping, packing lists or habits) and won’t be restored.`,
  verifySkipped: (n: number) =>
    n === 1
      ? '1 table comes from a different app version and is skipped.'
      : `${n} tables come from a different app version and are skipped.`,
  steps: {
    format: 'File format',
    checksum: 'Checksum (SHA-256)',
    decrypt: 'Decryption',
    structure: 'Content valid',
    restore: 'Trial restore',
    counts: 'Count per module matches',
  } as Record<string, string>,
  stepStatus: { ok: 'ok', failed: 'Error', skipped: '–' } as Record<string, string>,
  core: 'Settings',
  previewTitle: 'What the restore will do',
  previewRow: (module: string, added: number, replaced: number, removed: number) =>
    `${module}: ${added} new, ${replaced} replaced${removed > 0 ? `, ${removed} deleted` : ''}`,
  previewTotals: (added: number, replaced: number, removed: number) =>
    `Total: ${added} added, ${replaced} replaced, ${removed} deleted.`,
  previewNothing: 'Nothing changes.',
  safetyNote:
    'First, the app automatically makes a safety copy of your current data. If anything goes wrong, everything stays as it was.',
  restoring: 'Restoring …',
  autoTitle: 'Automatic backups',
  autoIntro:
    'The app regularly saves an encrypted backup to its data folder and keeps the newest copies. The password is kept in the device’s key store.',
  autoUnsupported: 'Automatic backups are only available in the installed app (Windows, Android).',
  autoEnable: 'Back up automatically',
  autoInterval: 'Frequency',
  autoDaily: 'Daily',
  autoWeekly: 'Weekly',
  autoKeep: 'Number of copies',
  autoPassphrase: 'Password for automatic backups',
  autoPassphraseSet: 'Password saved. Enter a new password to replace it.',
  autoPassphraseHint:
    'At least 8 characters. Write it down: without the password the copies can’t be opened.',
  autoSavePassphrase: 'Save password',
  autoRunNow: 'Back up now',
  autoLast: 'Last backup',
  autoNever: 'none yet',
  autoLastFailed: 'The last backup failed.',
  autoNeedPassphrase: 'Set a password first.',
  autoCreated: 'Backup created.',
  autoFiles: 'Existing copies',
  autoNoFiles: 'No copies yet.',
  autoUse: 'Open',
  autoSaveAs: 'Save as …',
  errors: {
    'not-json': 'The file isn’t a valid JSON file.',
    'wrong-format': 'This isn’t a Nemo backup file.',
    'newer-version': 'The backup comes from a newer app version.',
    invalid: 'The backup file is damaged.',
    'passphrase-required': 'This backup is encrypted. Enter the password.',
    'wrong-passphrase': 'Wrong password – or the file was changed.',
    'checksum-mismatch': 'The checksum doesn’t match: the file is damaged or incomplete.',
    'restore-failed': 'The trial restore failed.',
    'count-mismatch': 'Entries are missing after the trial restore.',
    'safety-failed': 'The safety copy couldn’t be created. Nothing was changed.',
    'safety-cancelled': 'No restore without a safety copy. Nothing was changed.',
    'restore-error': 'The restore failed. Nothing was changed.',
  } as Record<string, string>,
};
