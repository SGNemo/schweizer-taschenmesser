/**
 * A folder or ZIP of Markdown files (an Obsidian vault, Notion's Markdown export, any notes folder).
 * Front matter, `#tags` and `[[wikilinks]]` are handled by `parseMarkdownNote`; here come the
 * folder layer: hidden folders (`.obsidian`, `.trash`, `.git`) are skipped, the top-level folder
 * becomes the note's `folder` (a notebook), and attachments that cannot be stored are counted.
 */
import { parseMarkdownNote, type ParsedNote } from '@/core/io/markdownNote';
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
    .filter(
      (f) => !NOT_NOTES.test(f.path) && !f.path.split('/').some((seg) => seg.startsWith('.')),
    );
  // The vault's own name (one folder around everything) is not a notebook.
  const roots = new Set(notesFiles.map((f) => f.path.split('/')[0]));
  const dropRoot = roots.size === 1 && notesFiles.every((f) => f.path.includes('/'));
  const notes: ParsedNote[] = [];
  for (const file of notesFiles) {
    const segments = file.path.split('/').slice(dropRoot ? 1 : 0);
    const text = file.text.replace(EMBED, () => {
      addSkip(skipped, 'attachment');
      return '';
    });
    const clean = text.replace(LOCAL_IMAGE, () => {
      addSkip(skipped, 'attachment');
      return '';
    });
    const note = parseMarkdownNote(clean, segments[segments.length - 1] ?? file.path);
    if (!note) {
      addSkip(skipped, 'empty');
      continue;
    }
    if (segments.length > 1) note.folder = segments[0]!.trim();
    notes.push(note);
  }
  return { notes, skipped, total: notesFiles.length };
}
