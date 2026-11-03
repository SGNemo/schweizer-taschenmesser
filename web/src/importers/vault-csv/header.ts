/** Header profiles of the password managers whose CSV exports Nemo's vault can read (mapping only). */
import { normalizeHeader } from '@/core/io/csv';

export type VaultCsvFormat = 'bitwarden' | 'keepass' | 'onepassword';

/**
 * Column names per field for the formats that are not Bitwarden. KeePassXC writes `Group, Title,
 * Username, Password, URL, Notes, TOTP …`; KeePass 2 `Account, Login Name, Password, Web Site,
 * Comments`; 1Password `Title, Website|Url, Username, Password, One-time password, Favorite,
 * Archived, Tags, Notes`. Names differ by version and language, hence aliases.
 */
export const ALIASES = {
  title: ['title', 'name', 'account'],
  username: ['username', 'user name', 'login name', 'login'],
  password: ['password'],
  url: ['url', 'website', 'web site', 'login uri'],
  notes: ['notes', 'comments', 'note'],
  group: ['group', 'folder'],
  totp: ['totp', 'otpauth', 'one time password', 'first one time password', 'otp'],
  tags: ['tags'],
  favorite: ['favorite'],
  archived: ['archived'],
} as const;

export type VaultField = keyof typeof ALIASES;

/** Which format a header row is: Bitwarden has `type`, 1Password has `archived`/`tags`, the rest is KeePass. */
export function detectVaultCsv(header: readonly string[]): VaultCsvFormat | undefined {
  const keys = new Set(header.map(normalizeHeader));
  if (keys.has('name') && keys.has('type')) return 'bitwarden';
  const has = (f: VaultField) => ALIASES[f].some((n) => keys.has(n));
  if (!has('title') || !has('password')) return undefined;
  return keys.has('archived') || keys.has('tags') || keys.has('website')
    ? 'onepassword'
    : 'keepass';
}
