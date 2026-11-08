import { markdownToPlain, plainToMarkdown } from './editor/markdown';
import { parseMarkdownNote, type ParsedNote } from '@/core/io/markdownNote';
import { isHiddenPath } from '@/importers/files';
import { placeOf, stripAttachments, withFolderTag } from '@/importers/obsidian/parse';
import { displayTitle, isScratch } from './logic';
import type { Note } from './schema';

type Page = Pick<Note, 'title' | 'body'> & { id: string };

/** File-name safe form of a title (no path characters, no trailing dots), at most 80 characters. */
export function safeFileName(title: string, fallback = 'Notiz'): string {
  const clean = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
    .trim();
  return clean || fallback;
}

const nameOf = (p: Page, scratchName: string) => (isScratch(p) ? scratchName : displayTitle(p));

/** One page as Markdown: the title as a heading unless the text starts with it already. */
export function pageToMarkdown(p: Page, scratchName = 'Scratchpad'): string {
  const title = (isScratch(p) ? scratchName : p.title).trim();
  const body = p.body.trim();
  if (!title) return body;
  const first = body.split('\n', 1)[0] ?? '';
  const heading = /^#{1,6}\s+(.*?)\s*#*$/.exec(first)?.[1];
  return heading && heading.toLowerCase() === title.toLowerCase()
    ? body
    : `# ${title}\n\n${body}`.trimEnd();
}

/** Several pages in one Markdown file, separated by a rule, in the given order. */
export function pagesToMarkdown(pages: readonly Page[], scratchName = 'Scratchpad'): string {
  return pages.map((p) => pageToMarkdown(p, scratchName)).join('\n\n---\n\n') + '\n';
}

/** Plain text without Markdown syntax: title, blank line, text. */
export function pageToText(p: Page, scratchName = 'Scratchpad'): string {
  const title = nameOf(p, scratchName).trim();
  const body = markdownToPlain(p.body).trim();
  const first = body.split('\n', 1)[0]?.trim();
  return first && first === title ? `${body}\n` : `${title}\n\n${body}\n`;
}

export function pagesToText(pages: readonly Page[], scratchName = 'Scratchpad'): string {
  return pages.map((p) => pageToText(p, scratchName)).join('\n----\n\n');
}

/* ---- import ---- */

export interface ImportFile {
  /** Path as the browser reports it (`Ordner/Datei.md`); a plain file name when no folder was picked. */
  path: string;
  text: string;
}

export interface ImportedPage {
  /** Top-level folder name = notebook; `null` for single files. */
  folder: string | null;
  title: string;
  body: string;
}

const TEXT_FILE = /\.(?:md|markdown|txt)$/i;

/**
 * Reads `.md` / `.txt` files; a picked folder becomes the notebook, `.txt` keeps its line breaks.
 * An export (an Obsidian vault with `.obsidian`, or a folder with several sub-folders) is read like
 * the vault importer: the picked folder itself is no notebook, its sub-folders are. Deeper folders
 * become a tag, hidden folders (`.obsidian`, `.trash`) are left out and embedded pictures are
 * removed from the text.
 */
export function parseImport(files: readonly ImportFile[]): {
  pages: ImportedPage[];
  skipped: number;
} {
  const pages: ImportedPage[] = [];
  let skipped = 0;
  const paths = files.map((f) => ({ ...f, path: f.path.replaceAll('\\', '/') }));
  const visible = paths.filter((f) => !isHiddenPath(f.path));
  // An export (Obsidian vault: a `.obsidian` folder, or several sub-folders under the picked one):
  // the picked folder is no notebook, its sub-folders are. A plain folder stays one notebook.
  const roots = new Set(visible.map((f) => f.path.split('/')[0]));
  const subFolders = new Set(
    visible
      .map((f) => f.path.split('/').filter(Boolean))
      .filter((s) => s.length > 2)
      .map((s) => s[1]),
  );
  const vault =
    roots.size === 1 &&
    (paths.some((f) => f.path.split('/').includes('.obsidian')) || subFolders.size > 1) &&
    subFolders.size > 0;
  for (const file of visible) {
    const segments = file.path.split('/').filter(Boolean);
    const base = segments[segments.length - 1] ?? file.path;
    if (!TEXT_FILE.test(base)) {
      skipped++;
      continue;
    }
    const parsed: ParsedNote | undefined = parseMarkdownNote(
      stripAttachments(file.text).text,
      base,
    );
    if (!parsed) {
      skipped++;
      continue;
    }
    // Deeper folders become a tag, so nothing of the folder order is lost.
    const place = placeOf(segments.slice(vault ? 1 : 0, -1));
    const note = withFolderTag(parsed, place.tag);
    const body = /\.txt$/i.test(base) ? plainToMarkdown(note.body) : note.body;
    pages.push({ folder: place.folder ?? null, title: note.title, body });
  }
  return { pages, skipped };
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Same title and the same first 80 characters of text = the same note (also used by the file importer). */
export const noteKey = (title: string, body: string): string =>
  `${norm(title)}|${norm(body).slice(0, 80)}`;
