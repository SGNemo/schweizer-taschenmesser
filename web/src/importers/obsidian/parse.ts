/**
 * A folder or ZIP of Markdown files (an Obsidian vault, Notion's Markdown export, any notes folder).
 * Front matter, `#tags` and `[[wikilinks]]` are handled by `parseMarkdownNote`; here come the
 * folder layer: hidden folders (`.obsidian`, `.trash`, `.git`) are skipped, the top-level folder
 * becomes the note's `folder` (a notebook), deeper folders become a tag (`10_Arbeit/Projekte/a.md` →
 * notebook `10_Arbeit`, tag `#Projekte`; notebooks are flat), and attachments that cannot be stored
 * are counted.
 */
import { parseMarkdownNote, withTagLine, type ParsedNote } from '@/core/io/markdownNote';
import { isHiddenPath } from '../files';
import { addSkip, type SkipCounts, type SourceFile } from '../types';

export interface MarkdownFolderResult {
  notes: ParsedNote[];
  skipped: SkipCounts;
  total: number;
}

// Notes are Markdown/text; an unknown extension counts as text (the user chose the file), known data formats do not.
const NOT_NOTES = /\.(?:json|csv|ics|xml|enex|opml|html?|qif|ofx|sta|mt940)$/i;
const MEDIA = String.raw`(?:png|jpe?g|gif|webp|svg|bmp|heic|pdf|mp3|m4a|wav|mp4|mov|webm|zip|docx?|xlsx?|pptx?)`;
// ![[picture.png]], ![[picture.png|300]]  and  ![alt](attachments/picture.png)  (not web links)
const EMBED = new RegExp(String.raw`!\[\[[^\]\n]+?\.${MEDIA}(?:\|[^\]\n]*)?\]\]`, 'gi');
const LOCAL_IMAGE = new RegExp(
  String.raw`!\[[^\]\n]*\]\((?!https?:|data:)[^)\n]+?\.${MEDIA}(?:\?[^)\n]*)?\)`,
  'gi',
);

/** Numbered folders (`10_Arbeit`, `2_Privat`) in the order of their numbers. */
export const byFolderOrder = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Removes embedded or linked local media (`![[a.png]]`, `![x](bilder/a.jpg)`); web images stay. */
export function stripAttachments(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text
    .replace(EMBED, () => {
      removed++;
      return '';
    })
    .replace(LOCAL_IMAGE, () => {
      removed++;
      return '';
    });
  return { text: out, removed };
}

/** A folder name as a tag: letters, digits, `_`, `-`; anything else becomes `-`. */
const folderTag = (name: string): string =>
  name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Where a file goes, from its folders below the export root: the first folder is the notebook,
 * the folders below it become one nested tag (`Projekte/Kunde-A`), so nothing of the order is lost.
 */
export function placeOf(dirs: readonly string[]): { folder?: string; tag?: string } {
  const folder = dirs[0]?.trim();
  if (!folder) return {};
  const tag = dirs.slice(1).map(folderTag).filter(Boolean).join('/');
  // A purely numeric name (`2024`) is no tag in Markdown (`#2024`); it stays out.
  return tag && /^[\p{L}\p{N}_]/u.test(tag) && !/^\d+$/.test(tag) ? { folder, tag } : { folder };
}

/** Adds the sub-folder tag to a parsed note (text and tag list). */
export function withFolderTag(note: ParsedNote, tag: string | undefined): ParsedNote {
  if (!tag) return note;
  const known = note.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  return {
    ...note,
    body: withTagLine(note.body, [tag]),
    tags: known ? note.tags : [...note.tags, tag],
  };
}

/** Path inside the export without the archive name (`vault.zip/Vault/A/b.md` → `Vault/A/b.md`). */
const inner = (name: string) => name.replace(/^.*?\.zip\//i, '');

export function parseMarkdownFolder(
  files: readonly SourceFile[],
  opts: { binary?: number } = {},
): MarkdownFolderResult {
  const skipped: SkipCounts = {};
  addSkip(skipped, 'attachment', opts.binary ?? 0);
  const notesFiles = files
    .map((f) => ({ path: inner(f.name).replaceAll('\\', '/'), text: f.text }))
    .filter((f) => !NOT_NOTES.test(f.path) && !isHiddenPath(f.path));
  // The vault's own name (one folder around everything) is not a notebook.
  const roots = new Set(notesFiles.map((f) => f.path.split('/')[0]));
  const dropRoot = roots.size === 1 && notesFiles.every((f) => f.path.includes('/'));
  const notes: ParsedNote[] = [];
  for (const file of notesFiles) {
    const segments = file.path.split('/').slice(dropRoot ? 1 : 0);
    const { text, removed } = stripAttachments(file.text);
    addSkip(skipped, 'attachment', removed);
    const parsed = parseMarkdownNote(text, segments[segments.length - 1] ?? file.path);
    if (!parsed) {
      addSkip(skipped, 'empty');
      continue;
    }
    const place = placeOf(segments.slice(0, -1));
    const note = withFolderTag(parsed, place.tag);
    if (place.folder) note.folder = place.folder;
    notes.push(note);
  }
  return { notes, skipped, total: notesFiles.length };
}
