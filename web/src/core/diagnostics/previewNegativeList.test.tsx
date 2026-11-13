// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup } from '@/core/backup/backup';
import { putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { readRecent } from '@/core/search/recent';
import { FilePreview } from '@/modules/vault/components/FilePreview';
import { documentRepo } from '@/modules/vault/repo';
import { errorLog } from './errorLog';
import { buildDiagnostics, renderDiagnostics } from './export';

/**
 * Negative list for the picture preview of Unterlagen (module package T-a): while a preview is on screen, nothing
 * of it is anywhere but in memory. A diagnostics report holds neither the document's title, the file name nor the
 * object URL; the object URL is in no table (so in no sync operation, reminder or backup) and in no stored key
 * (so not in the palette's recent entries); showing it adds no row and no key.
 */
const TITLE = 'KANARIENVOGEL-Reisepass';
const FILE = 'kanarienvogel-ausweis.png';
const URL_MARK = 'blob:kanarienvogel-url';

const tablesAsText = async () =>
  JSON.stringify(
    Object.fromEntries(
      await Promise.all(
        // Blobs are binary and not JSON; their keys are what could change.
        db.tables.map(async (tb) =>
          tb.name === '_blobs'
            ? ([tb.name, await tb.toCollection().primaryKeys()] as const)
            : ([tb.name, await tb.toArray()] as const),
        ),
      ),
    ),
  );
const storageAsText = () => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]);

describe('picture preview of Unterlagen: the negative list', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
    await db.table('_blobs').clear();
    URL.createObjectURL = vi.fn(() => URL_MARK);
    URL.revokeObjectURL = vi.fn();
  });

  it('is in no diagnostics report, error log, table, backup, stored key or recent search', async () => {
    const doc = await documentRepo.create({
      title: TITLE,
      category: 'identity',
      fileName: FILE,
      fileType: 'image/png',
    } as never);
    await putBlob(doc.id, new Blob(['x'], { type: 'image/png' }));
    const tablesBefore = await tablesAsText();
    const storageBefore = storageAsText();
    const recentBefore = readRecent();

    render(<FilePreview id={doc.id} fileName={FILE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    await screen.findByAltText(`Vorschau: ${FILE}`);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Diagnostics: nothing of the document at all.
    const report = renderDiagnostics(await buildDiagnostics());
    const log = JSON.stringify(errorLog());
    for (const text of [report, log]) {
      expect(text.toLowerCase()).not.toContain('kanarienvogel');
      expect(text).not.toContain('blob:');
    }

    // Sync, reminders, backup: every table is as it was, so no operation, no reminder and no row was added.
    const tablesAfter = await tablesAsText();
    expect(tablesAfter).toBe(tablesBefore);
    expect(tablesAfter).not.toContain('blob:');
    // The backup holds the record (it is the user's data), never the preview.
    expect(JSON.stringify(await createBackup())).not.toContain('blob:');

    // Palette and every other stored key (recent entries, drafts, the persisted error copy).
    expect(storageAsText()).toBe(storageBefore);
    expect(readRecent()).toEqual(recentBefore);
  });
});
