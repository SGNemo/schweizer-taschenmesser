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

describe('D17 (round 5): an imported note keeps its date', () => {
  it('created: 2025-12-01 sorts below a note written today under "Zuletzt geändert"', async () => {
    const { getManifest } = await import('@/core/modules/registry');
    const { buildPreview } = await import('@/core/importer/plan');
    const { commitImport } = await import('@/core/importer/batches');
    const { noteRepo } = await import('../repo');
    const { sortPages } = await import('../logic');
    const notes = getManifest('notes')!;
    await noteRepo.create({
      title: 'Heute',
      body: 'neu',
      pinned: false,
      notebookId: null,
      order: 0,
    });
    const parsed = await runtime.parse(
      'file',
      {
        kind: 'file',
        fileName: 'Vault.zip',
        text: '',
        files: [
          { name: 'Vault.zip/Alt.md', text: '---\ncreated: 2025-12-01\n---\n# Alt\nVom Dezember' },
          {
            name: 'Vault.zip/Datei.md',
            text: '# Datei\nOhne Kopf',
            modifiedAt: Date.UTC(2026, 0, 2),
          },
        ],
      },
      ctx,
    );
    const rows = await buildPreview(notes, runtime, parsed.candidates);
    await commitImport(notes, { batchId: 'd17', importerId: 'file', source: 'Vault.zip', rows });
    const stored = await noteRepo.active().toArray();
    const alt = stored.find((n) => n.title === 'Alt')!;
    expect(alt.createdAt).toBe(new Date(2025, 11, 1).getTime());
    expect(stored.find((n) => n.title === 'Datei')!.updatedAt).toBe(Date.UTC(2026, 0, 2));
    expect(sortPages(stored, 'recent').map((n) => n.title)).toEqual(['Heute', 'Datei', 'Alt']);
  });
});
