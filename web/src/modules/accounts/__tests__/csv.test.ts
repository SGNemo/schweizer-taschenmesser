import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportEncryptedBackup, importEncryptedBackup, withoutDuplicates } from '../backup';
import {
  BITWARDEN_HEADER,
  CsvFormatError,
  exportBitwardenCsv,
  importBitwardenCsv,
  parseCsv,
  toCsv,
} from '../csv';
import { entryDataSchema } from '../schema';

const entry = (over: Record<string, unknown>) => entryDataSchema.parse({ title: 'x', ...over });

describe('CSV parsing (RFC 4180)', () => {
  it('handles quotes, doubled quotes, commas, CRLF and line breaks inside fields', () => {
    const text = 'a,b,c\r\n"1,5","he said ""hi""","line1\nline2"\r\n\r\nlast,,\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1,5', 'he said "hi"', 'line1\nline2'],
      ['last', '', ''],
    ]);
  });

  it('ignores a BOM and round-trips through toCsv', () => {
    const rows = [['a', 'b,c', 'd"e', 'f\ng']];
    expect(parseCsv(`${String.fromCharCode(0xfeff)}${toCsv(rows)}`)).toEqual(rows);
  });
});

describe('Bitwarden CSV', () => {
  const sample = [
    BITWARDEN_HEADER.join(','),
    'Privat,1,login,GitHub,"Notiz, mit Komma",,0,https://github.com,alice,"pa""ss,word",otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
    ',,note,WLAN-Zettel,Passwort im Schrank,,0,,,,',
    ',,card,Visa,,,0,,,,',
    ',,login,,,,0,,,,',
  ].join('\n');

  it('imports logins and notes, skips other types', () => {
    const { entries, skipped } = importBitwardenCsv(sample);
    expect(skipped).toBe(2);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      title: 'GitHub',
      username: 'alice',
      password: 'pa"ss,word',
      url: 'https://github.com',
      notes: 'Notiz, mit Komma',
      tags: ['Privat'],
      favorite: true,
    });
    expect(entries[0]!.totp).toMatchObject({ secret: 'JBSWY3DPEHPK3PXP', issuer: 'GitHub' });
    expect(entries[1]).toMatchObject({
      title: 'WLAN-Zettel',
      notes: 'Passwort im Schrank',
      tags: [],
      favorite: false,
    });
  });

  it('exports in the same format and round-trips', () => {
    const original = [
      entry({
        title: 'Bank; "Haupt"',
        username: 'u',
        password: 'p,w',
        url: 'https://bank.example',
        notes: 'a\nb',
        tags: ['Finanzen'],
        favorite: true,
      }),
      entry({ title: 'Nur Notiz', notes: 'secret note' }),
    ];
    const csv = exportBitwardenCsv(original);
    expect(csv.split('\r\n')[0]).toBe(BITWARDEN_HEADER.join(','));
    const { entries, skipped } = importBitwardenCsv(csv);
    expect(skipped).toBe(0);
    expect(entries).toEqual(original);
  });

  it('rejects files that are not Bitwarden exports', () => {
    expect(() => importBitwardenCsv('foo,bar\n1,2')).toThrow(CsvFormatError);
    expect(() => importBitwardenCsv('')).toThrow(CsvFormatError);
  });
});

describe('encrypted backup file', () => {
  const FAST = { m: 64, t: 1, p: 1 };
  const entries = [entry({ title: 'Mail', password: 'geheim-123', totp: undefined })];

  it('round-trips and reveals nothing without the password', async () => {
    const file = await exportEncryptedBackup(entries, 'backup-passwort', FAST);
    expect(file).not.toContain('Mail');
    expect(file).not.toContain('geheim-123');
    expect(await importEncryptedBackup(file, 'backup-passwort')).toEqual(entries);
    await expect(importEncryptedBackup(file, 'falsch')).rejects.toMatchObject({
      code: 'wrong-key',
    });
    await expect(importEncryptedBackup('kein json', 'x')).rejects.toMatchObject({
      code: 'malformed',
    });
  });

  it('a taschenmesser-vault-backup file written before the rename to Nemo still imports', async () => {
    const text = readFileSync(resolve(__dirname, 'fixtures/legacy-vault-2026-01-01.json'), 'utf8');
    expect(text).toContain('"taschenmesser-vault-backup"');
    const imported = await importEncryptedBackup(text, 'legacy-vault-passphrase');
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ title: 'Beispiel-Postfach', username: 'nemo@example.com' });
    await expect(importEncryptedBackup(text, 'wrong')).rejects.toMatchObject({ code: 'wrong-key' });
  });

  it('skips entries that already exist', () => {
    const a = entry({ title: 'A', password: '1' });
    const b = entry({ title: 'B', password: '2' });
    expect(withoutDuplicates([a], [a, b, b])).toEqual({ fresh: [b], duplicates: 2 });
  });
});

describe('KeePass and 1Password CSV (mapping only)', () => {
  it('reads a KeePassXC export: group path → folder tag, TOTP, quotes and umlauts', async () => {
    const { importVaultCsv } = await import('../csv');
    const text = [
      'Group,Title,Username,Password,URL,Notes,TOTP,Icon,Last Modified,Created',
      '"Root/Internet","Müller & Söhne","anna@example.org","p""w,1","https://example.org","Zeile 1\nZeile 2","JBSWY3DPEHPK3PXP",0,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z',
      'Root,Ohne Passwort,,,,,,0,,',
      'Root,,x,y,,,,0,,',
    ].join('\r\n');
    const r = importVaultCsv(text);
    expect(r.format).toBe('keepass');
    expect(r.skipped).toBe(1);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({
      title: 'Müller & Söhne',
      username: 'anna@example.org',
      password: 'p"w,1',
      url: 'https://example.org',
      notes: 'Zeile 1\nZeile 2',
      tags: ['Internet'],
    });
    expect(r.entries[0]!.totp).toBeDefined();
    expect(r.entries[1]!.tags).toEqual([]);
  });

  it('reads a KeePass 2 export with its older column names', async () => {
    const { importVaultCsv } = await import('../csv');
    const r = importVaultCsv(
      '"Account","Login Name","Password","Web Site","Comments"\n"Bank","u1","pw","https://bank.example","n"',
    );
    expect(r.format).toBe('keepass');
    expect(r.entries[0]).toMatchObject({
      title: 'Bank',
      username: 'u1',
      url: 'https://bank.example',
    });
  });

  it('reads a 1Password export, leaves archived items out, splits tags', async () => {
    const { importVaultCsv } = await import('../csv');
    const text = [
      'Title,Website,Username,Password,One-time password,Favorite,Archived,Tags,Notes',
      'Shop,https://shop.example,me,secret,,true,false,"Privat;Einkauf",Hi',
      'Alt,https://old.example,me,old,,false,true,,',
    ].join('\n');
    const r = importVaultCsv(text);
    expect(r.format).toBe('onepassword');
    expect(r.skipped).toBe(1);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({
      title: 'Shop',
      favorite: true,
      tags: ['Privat', 'Einkauf'],
    });
  });

  it('keeps Bitwarden working and rejects other CSVs', async () => {
    const { importVaultCsv } = await import('../csv');
    expect(importVaultCsv(exportBitwardenCsv([entry({ title: 'A', password: 'p' })])).format).toBe(
      'bitwarden',
    );
    expect(() => importVaultCsv('a,b\n1,2')).toThrow(CsvFormatError);
    expect(() => importVaultCsv('')).toThrow(CsvFormatError);
  });
});
