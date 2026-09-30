import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { PdfError, extractPages, mergePdfs, pageCount, rotatePages } from './pdf';

/** A PDF whose page n has the width 100 + n, so pages can be told apart. */
async function make(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let n = 1; n <= pages; n++) doc.addPage([100 + n, 200]);
  return doc.save();
}

const widths = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth());

describe('pdf editing', () => {
  it('counts pages', async () => {
    expect(await pageCount(await make(4))).toBe(4);
  });

  it('merges files in the order given', async () => {
    const merged = await mergePdfs([await make(2), await make(3)]);
    expect(await widths(merged)).toEqual([101, 102, 101, 102, 103]);
    expect(await widths(await mergePdfs([await make(1), await make(2), await make(1)]))).toEqual([
      101, 101, 102, 101,
    ]);
  });

  it('extracts pages in the requested order', async () => {
    const out = await extractPages(await make(5), [4, 2, 3]);
    expect(await widths(out)).toEqual([104, 102, 103]);
  });

  it('rotates only the chosen pages, on top of an existing rotation', async () => {
    const once = await rotatePages(await make(3), [2, 3], 90);
    const doc = await PDFDocument.load(once);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 90]);
    const twice = await PDFDocument.load(await rotatePages(once, [3], 270));
    expect(twice.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
  });

  it('refuses nothing to do and files that are not PDFs', async () => {
    await expect(mergePdfs([])).rejects.toMatchObject({ code: 'empty' });
    await expect(extractPages(await make(2), [])).rejects.toMatchObject({ code: 'empty' });
    await expect(pageCount(new TextEncoder().encode('kein pdf'))).rejects.toBeInstanceOf(PdfError);
    await expect(mergePdfs([await make(1), new Uint8Array([1, 2, 3])])).rejects.toMatchObject({
      code: 'invalid',
    });
  });
});
