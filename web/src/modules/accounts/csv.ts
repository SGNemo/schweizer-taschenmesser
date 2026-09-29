/**
 * Bitwarden-compatible CSV (the "Export vault → .csv" format) for moving in and out. The file holds
 * every secret in plain text – the UI asks for confirmation before exporting one.
 */
import { parseCsv as parseCsvCore, toCsv as toCsvCore } from '@/core/io/csv';
import { entryDataSchema, type EntryData } from './schema';
import { parseTotpInput, totpUri } from './totp';

export const BITWARDEN_HEADER = [
  'folder',
  'favorite',
  'type',
  'name',
  'notes',
  'fields',
  'reprompt',
  'login_uri',
  'login_username',
  'login_password',
  'login_totp',
] as const;

/** Bitwarden exports always use commas, so the delimiter is fixed (no auto-detection). */
export const parseCsv = (text: string): string[][] => parseCsvCore(text, { delimiter: ',' });

export const toCsv = (rows: readonly (readonly string[])[]): string => toCsvCore(rows, ',');

export interface CsvImport {
  entries: EntryData[];
  /** Rows of types we do not store (cards, identities) or without a name. */
  skipped: number;
}

export class CsvFormatError extends Error {
  constructor() {
    super('not a Bitwarden CSV');
    this.name = 'CsvFormatError';
  }
}

export function importBitwardenCsv(text: string): CsvImport {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new CsvFormatError();
  const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  if (!('name' in col) || !('type' in col)) throw new CsvFormatError();
  const get = (row: string[], key: string) => (key in col ? (row[col[key]!] ?? '') : '');

  const entries: EntryData[] = [];
  let skipped = 0;
  for (const row of rows) {
    const type = get(row, 'type').trim().toLowerCase();
    const title = get(row, 'name').trim();
    if ((type !== 'login' && type !== 'note') || !title) {
      skipped++;
      continue;
    }
    const folder = get(row, 'folder').trim();
    entries.push(
      entryDataSchema.parse({
        title,
        username: get(row, 'login_username'),
        password: get(row, 'login_password'),
        // Bitwarden separates several URIs by line breaks; we keep the first.
        url: get(row, 'login_uri').split(/\r?\n/)[0]!.trim(),
        notes: get(row, 'notes'),
        tags: folder ? [folder] : [],
        favorite: get(row, 'favorite').trim() === '1',
        totp: parseTotpInput(get(row, 'login_totp')),
      }),
    );
  }
  return { entries, skipped };
}

export function exportBitwardenCsv(entries: readonly EntryData[]): string {
  const rows = entries.map((e) => [
    e.tags[0] ?? '',
    e.favorite ? '1' : '',
    e.password || e.username || e.url || e.totp ? 'login' : 'note',
    e.title,
    e.notes,
    '',
    '0',
    e.url,
    e.username,
    e.password,
    e.totp ? totpUri(e.totp, e.title) : '',
  ]);
  return toCsv([BITWARDEN_HEADER, ...rows]);
}
