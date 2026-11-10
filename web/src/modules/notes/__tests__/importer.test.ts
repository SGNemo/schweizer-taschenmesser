// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import runtime from '../importer';

afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const ctx = { today: '2026-11-08', options: {}, batchId: 'd' };

describe('notes file importer – an exported Obsidian vault (D05, D06)', () => {
  const files = [
    { name: 'Vault.zip/Vault/.obsidian/app.json', text: '{"theme":"obsidian"}' },
    { name: 'Vault.zip/Vault/.obsidian/workspace.json', text: '{"main":{}}' },
    { name: 'Vault.zip/Vault/90_Archiv/Rückblick.md', text: '# Rückblick\nAbgelegt' },
    { name: 'Vault.zip/Vault/10_Arbeit/Halle 3.md', text: '# Halle 3\nIP-Plan' },
    { name: 'Vault.zip/Vault/2_Privat/Ideen.md', text: 'Kleine Ideen' },
  ];

  it('creates the notebooks in the order of their numbers', async () => {
    const parsed = await runtime.parse(
      'file',
      { kind: 'file', fileName: 'Vault.zip', text: '', files },
      ctx,
    );
    const books = parsed.candidates.filter((c) => c.collection === 'notebook').map((c) => c.label);
    expect(books).toEqual(['2_Privat', '10_Arbeit', '90_Archiv']);
  });

  it('does not report the vault settings as unreadable files', async () => {
    const parsed = await runtime.parse(
      'file',
      { kind: 'file', fileName: 'Vault.zip', text: '', files },
      ctx,
    );
    expect(parsed.skipped).toEqual({});
    expect(parsed.notes).toEqual([]);
    expect(parsed.candidates.filter((c) => c.collection === 'note')).toHaveLength(3);
  });
});
