/**
 * PDF editing with pdf-lib, loaded only when a PDF tool is used (the library is about 500 KB).
 * Everything happens in memory on the device; nothing is uploaded.
 */
import type { Rotation } from './logic';

export class PdfError extends Error {
  constructor(readonly code: 'invalid' | 'encrypted' | 'empty') {
    super(code);
  }
}

async function lib() {
  return import('pdf-lib');
}

async function open(bytes: Uint8Array) {
  const { PDFDocument } = await lib();
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    // pdf-lib refuses encrypted files unless told to ignore the encryption, which would give garbage.
    throw new PdfError(e instanceof Error && /encrypt/i.test(e.message) ? 'encrypted' : 'invalid');
  }
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await open(bytes)).getPageCount();
}

/** All pages of all files, in the order given. */
export async function mergePdfs(files: readonly Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) throw new PdfError('empty');
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const doc = await open(bytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

/** A new PDF with only `pages` (1-based, in that order). */
export async function extractPages(
  bytes: Uint8Array,
  pages: readonly number[],
): Promise<Uint8Array> {
  if (pages.length === 0) throw new PdfError('empty');
  const { PDFDocument } = await lib();
  const doc = await open(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    doc,
    pages.map((n) => n - 1),
  );
  for (const p of copied) out.addPage(p);
  return out.save();
}

/** Turns `pages` (1-based) clockwise by `angle` on top of their current rotation; other pages stay. */
export async function rotatePages(
  bytes: Uint8Array,
  pages: readonly number[],
  angle: Rotation,
): Promise<Uint8Array> {
  const { degrees } = await lib();
  const doc = await open(bytes);
  for (const n of pages) {
    const page = doc.getPage(n - 1);
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  }
  return doc.save();
}
