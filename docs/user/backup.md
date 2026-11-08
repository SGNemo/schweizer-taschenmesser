**English** | [Deutsch](backup.de.md)

# Backup

*Settings → Sync & Backup* saves all data to a file and restores a backup. Credentials (sync token, keys) are never part of a backup.

## Creating a backup
- **Encrypted export (recommended):** the file is protected with a password (Argon2id, AES-256), at least 8 characters. Without this password the backup cannot be opened; there is no reset.
- **Download backup:** a JSON file with all entries in plain text, including deleted entries so merging works correctly.
- **Password vault:** the vault also has its own encrypted export.
- **Files in Documents** stay on the device where they were added and are not part of the backup.

## Automatic backups (Windows, Android)
In the installed app, Nemo can back up regularly and encrypted into its own data folder and keep the newest copies. Interval (daily, weekly) and number of copies are adjustable. The password is kept in the device's key store; write it down anyway, or the copies cannot be opened. The browser version (PWA) has no automatic backups.

## Checking a backup
"Check backup" tests a file without touching your data: file format, checksum (SHA-256), decryption, content, a trial restore into a temporary database, and the count per module.

## Restoring
- **Merge:** nothing gets lost; in a conflict the newer change wins.
- **Replace:** the backup becomes the current state. Entries that are not in the backup are deleted, also on other devices as soon as they sync.
- Beforehand the app shows what changes per module and automatically makes a safety copy of your current data. If anything fails, everything stays as it was.
- Tables of old, removed modules are skipped on restore; the app tells you how many.

## File format
The download without a password is readable JSON (indented, opens in any text editor):
- `format` (`taschenmesser-backup`), `version`, `about` (this description in one line), `exportedAt`.
- `tables`: one list per collection, named `<module>_<collection>` (e.g. `notes_note`, `notes_notebook`). Each entry has its fields plus `id`, `createdAt`, `updatedAt`, `deviceId`, `deletedAt` (deleted entries stay so merging works) and `_f` (a time stamp per field; the newer one wins).
- `checksum`: SHA-256 of `tables`; an edited file is refused.
- Restoring the same file gives the same entries (tested). Invented test data of the Dev-Preview is never part of a backup.

Moving between devices also works without a file via the [sync server](sync.md).
