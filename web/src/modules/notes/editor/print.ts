import { Editor } from '@tiptap/core';
import { noteExtensions } from './extensions';
import { loadImage } from './images';
import { pageToMarkdown } from '../exchange';
import type { Note } from '../schema';

type Page = Pick<Note, 'title' | 'body'> & { id: string };

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The page as HTML (rendered by an editor that is never shown); pictures of this device are inlined. */
export async function pageToHtml(page: Page, scratchName: string): Promise<string> {
  const editor = new Editor({
    extensions: noteExtensions(),
    content: pageToMarkdown(page, scratchName),
    contentType: 'markdown',
  });
  let html = editor.getHTML();
  editor.destroy();
  const sources = [...new Set([...html.matchAll(/src="(nemo-img:[^"]+)"/g)].map((m) => m[1]!))];
  for (const src of sources) {
    const blob = await loadImage(src);
    html = html.split(`src="${src}"`).join(blob ? `src="${await readAsDataUrl(blob)}"` : 'alt=""');
  }
  return html;
}

const PRINT_CSS = `
  @page { margin: 18mm; }
  body { font: 11pt/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #000; }
  h1 { font-size: 20pt; margin: 0 0 8pt; } h2 { font-size: 15pt; } h3 { font-size: 12.5pt; }
  p, ul, ol, pre, table, blockquote { margin: 0 0 8pt; }
  pre { background: #f2f2f2; padding: 8pt; white-space: pre-wrap; font: 9.5pt/1.4 ui-monospace, Consolas, monospace; }
  code { font-family: ui-monospace, Consolas, monospace; }
  blockquote { border-left: 3pt solid #888; padding-left: 8pt; color: #333; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1pt solid #666; padding: 3pt 6pt; text-align: left; }
  mark { background: #eee; } img { max-width: 100%; }
  ul[data-type='taskList'] { list-style: none; padding-left: 0; }
  ul[data-type='taskList'] li { display: flex; gap: 6pt; }
  .page + .page { break-before: page; }
`;

/** Opens the print dialog for the pages (each on its own sheet); "Save as PDF" there gives the PDF. */
export async function printPages(
  pages: readonly Page[],
  scratchName: string,
  title: string,
): Promise<void> {
  const parts: string[] = [];
  for (const p of pages)
    parts.push(`<section class="page">${await pageToHtml(p, scratchName)}</section>`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${parts.join('')}</body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.append(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 150));
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 120_000);
}
