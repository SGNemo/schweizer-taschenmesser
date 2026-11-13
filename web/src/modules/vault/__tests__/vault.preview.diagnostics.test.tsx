// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { buildDiagnostics, renderDiagnostics } from '@/core/diagnostics/export';
import { errorLog } from '@/core/diagnostics/errorLog';
import { FilePreview } from '../components/FilePreview';
import { documentRepo } from '../repo';

/**
 * Negative list for the picture preview (module package T-a): a diagnostics report written while a preview is on
 * screen holds nothing of it: not the document's title, not the file name, not the object URL.
 */
const TITLE = 'KANARIENVOGEL-Reisepass';
const FILE = 'kanarienvogel-ausweis.png';

describe('picture preview: nothing of it reaches a diagnostics report', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
    await db.table('_blobs').clear();
    URL.createObjectURL = vi.fn(() => 'blob:kanarienvogel-url');
    URL.revokeObjectURL = vi.fn();
  });

  it('title, file name and object URL are in neither the report nor the error log', async () => {
    const doc = await documentRepo.create({
      title: TITLE,
      category: 'identity',
      fileName: FILE,
      fileType: 'image/png',
    } as never);
    await putBlob(doc.id, new Blob(['x'], { type: 'image/png' }));
    render(<FilePreview id={doc.id} fileName={FILE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    await screen.findByAltText(`Vorschau: ${FILE}`);

    const report = renderDiagnostics(await buildDiagnostics());
    const log = JSON.stringify(errorLog());
    for (const text of [report, log]) {
      expect(text).not.toContain('KANARIENVOGEL');
      expect(text.toLowerCase()).not.toContain('kanarienvogel');
      expect(text).not.toContain('blob:');
    }
  });
});
