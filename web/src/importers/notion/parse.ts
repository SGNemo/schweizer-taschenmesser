/**
 * Notion export ("Markdown & CSV" ZIP). Pages are `Title <32 hex>.md`, sub-pages sit in a folder of
 * the same name, databases are a CSV plus one page per row, files next to the pages. The id suffix
 * is dropped from titles and folders; the page's property block ("Status: Done", "Tags: a, b") stays
 * as plain lines at the top of the text, tags also become `#tags`; links between exported pages
 * become `[[wikilinks]]`, links to pages that are not in the export keep only their text; images and
 * files are counted. Databases as CSV are not read (their rows are pages and come in as notes).
 */
import { parseMarkdownNote, type ParsedNote } from '@/core/io/markdownNote';
import { addSkip, type SkipCounts, type SourceFile } from '../types';

export interface NotionResult {
  notes: ParsedNote[];
  skipped: SkipCounts;
  total: number;
}

/** ` 0123456789abcdef0123456789abcdef` before the extension or at the end of a folder name. */
const ID = /\s[0-9a-f]{32}(?=\.[a-z0-9]+$|$)/i;
const PAGE = /\s[0-9a-f]{32}\.md$/i;

export const isNotionPath = (name: string): boolean => PAGE.test(name);

const stripId = (segment: string) => segment.replace(ID, '').trim();
const inner = (name: string) => name.replace(/^.*?\.zip\//i, '').replaceAll('\\', '/');
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const MEDIA =
  /\.(?:png|jpe?g|gif|webp|svg|bmp|heic|pdf|mp3|m4a|wav|mp4|mov|webm|zip|docx?|xlsx?|pptx?)$/i;

/** `Key: value` lines directly under the title belong to the property block. */
const PROPERTY = /^[^\s:#>*[-][^:\n]{0,40}:\s.*$/;

export function parseNotion(
  files: readonly SourceFile[],
  opts: { binary?: number } = {},
): NotionResult {
  const skipped: SkipCounts = {};
  addSkip(skipped, 'attachment', opts.binary ?? 0);
  const pages = files
    .map((f) => ({ path: inner(f.name), text: f.text }))
    .filter((f) => isNotionPath(f.path));
  addSkip(
    skipped,
    'unsupported',
    files.filter((f) => /\.csv$/i.test(f.name)).length, // database tables
  );
  // The titles that exist, by decoded file name without id, so links can be resolved.
  const titles = new Set(pages.map((p) => stripId(p.path.split('/').pop()!.replace(/\.md$/i, ''))));
  const notes: ParsedNote[] = [];
  // The export's own wrapper folder (`Export-<id>`) is not a notebook.
  const roots = new Set(pages.map((p) => p.path.split('/')[0]));
  const dropRoot = roots.size === 1 && pages.every((p) => p.path.includes('/'));
  for (const page of pages) {
    const segments = page.path.split('/').map(stripId);
    if (dropRoot) segments.shift();
    const fileTitle = segments.pop()!.replace(/\.md$/i, '');
    const text = page.text
      .replace(/\r\n?/g, '\n')
      // Images and files: nothing to store.
      .replace(/!\[[^\]\n]*\]\((?!https?:)[^)\n]+\)/g, () => {
        addSkip(skipped, 'attachment');
        return '';
      })
      .replace(
        /\[([^\]\n]+)\]\((?!https?:|mailto:|#)([^)\n]+)\)/g,
        (_m, label: string, href: string) => {
          const target = decode(href).split('/').pop()!;
          if (MEDIA.test(target)) {
            addSkip(skipped, 'attachment');
            return label;
          }
          const name = stripId(target.replace(/\.md$/i, ''));
          return titles.has(name) ? `[[${name}]]` : label;
        },
      );
    const lines = text.split('\n');
    // Title line, then the property block until the first blank line.
    let body = text;
    let tags: string[] = [];
    if (/^#\s/.test(lines[0] ?? '')) {
      let end = 1;
      while (lines[end] === '') end++;
      const props: string[] = [];
      while (end < lines.length && PROPERTY.test(lines[end]!)) props.push(lines[end++]!);
      if (props.length > 0) {
        for (const p of props) {
          const m = /^tags?:\s*(.+)$/i.exec(p);
          if (m)
            tags = m[1]!
              .split(',')
              .map((x) => x.trim().replace(/\s+/g, '-'))
              .filter(Boolean);
        }
        body = [lines[0], '', props.join('\n'), '', ...lines.slice(end)].join('\n');
      }
    }
    const note = parseMarkdownNote(body, `${fileTitle}.md`);
    if (!note) {
      addSkip(skipped, 'empty');
      continue;
    }
    if (!note.title) note.title = fileTitle;
    if (tags.length > 0) {
      const have = new Set(note.tags.map((x) => x.toLowerCase()));
      const missing = tags.filter((x) => !have.has(x.toLowerCase()));
      if (missing.length > 0)
        note.body = `${note.body.replace(/\s+$/, '')}\n\n${missing.map((x) => `#${x}`).join(' ')}`;
      note.tags = [...note.tags, ...missing];
    }
    if (segments[0]) note.folder = segments[0];
    notes.push(note);
  }
  return { notes, skipped, total: pages.length };
}
