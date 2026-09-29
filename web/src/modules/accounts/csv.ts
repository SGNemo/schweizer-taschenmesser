/**
 * Bitwarden-compatible CSV (the "Export vault → .csv" format) for moving in and out. The file holds
 * every secret in plain text – the UI asks for confirmation before exporting one.
 */
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

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF, line breaks inside quotes, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const escape = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}

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
