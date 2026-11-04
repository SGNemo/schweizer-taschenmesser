/**
 * Evernote export (`.enex`): `<en-export>` with one `<note>` per note (`title`, `content` = ENML in a
 * CDATA block, `created`, `updated`, `tag`, `note-attributes`, `resource` with base64 `data`).
 * Scanned with `indexOf` – no DOM, no regex over the (possibly huge) base64 blocks. Timestamps are
 * ignored like in the Keep import: the notes model sets its own. Attachments are counted, not stored.
 */
import { withTagLine, type ParsedNote } from '@/core/io/markdownNote';
import { addSkip, type SkipCounts } from '../types';
import { decodeEntities, enmlToMarkdown } from './enml';

export interface EnexResult {
  notes: ParsedNote[];
  skipped: SkipCounts;
  /** Notes in the file (also the skipped ones). */
  total: number;
  /** The text is not an Evernote export at all. */
  invalid: boolean;
}

/** Text between `<name …>` and `</name>` starting at `from`; the end index lets scanning go on. */
function element(src: string, name: string, from = 0): { inner: string; end: number } | undefined {
  const open = new RegExp(`<${name}(?:\\s[^>]*)?>`, 'g');
  open.lastIndex = from;
  const m = open.exec(src);
  if (!m) return undefined;
  const closeTag = `</${name}>`;
  const close = src.indexOf(closeTag, open.lastIndex);
  if (close < 0) return undefined;
  return { inner: src.slice(open.lastIndex, close), end: close + closeTag.length };
}

function plain(s: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  // CDATA is literal text (ENML markup); anything else is XML text with entities.
  return (cdata ? cdata[1]! : decodeEntities(s)).trim();
}

export function parseEnex(text: string): EnexResult {
  const src = text.replace(/^\uFEFF/, '');
  const result: EnexResult = { notes: [], skipped: {}, total: 0, invalid: false };
  if (!/<en-export[\s>]/.test(src)) return { ...result, invalid: true };
  let at = 0;
  for (;;) {
    const note = element(src, 'note', at);
    if (!note) break;
    at = note.end;
    result.total++;
    // Cut the resources out first: they hold the big base64 blocks and nothing we keep.
    let attachments = 0;
    let rest = note.inner;
    for (;;) {
      const start = rest.indexOf('<resource>');
      const stop = start < 0 ? -1 : rest.indexOf('</resource>', start);
      if (stop < 0) break;
      attachments++;
      rest = rest.slice(0, start) + rest.slice(stop + '</resource>'.length);
    }
    const title = plain(element(rest, 'title')?.inner ?? '');
    const content = element(rest, 'content')?.inner ?? '';
    const tags: string[] = [];
    for (let from = 0; ;) {
      const tag = element(rest, 'tag', from);
      if (!tag) break;
      from = tag.end;
      const name = plain(tag.inner).replace(/^#+/, '').replace(/\s+/g, '-');
      if (name && !tags.some((x) => x.toLowerCase() === name.toLowerCase())) tags.push(name);
    }
    const { markdown, media } = enmlToMarkdown(plain(content));
    addSkip(result.skipped, 'attachment', Math.max(attachments, media));
    if (title === '' && markdown === '') {
      addSkip(result.skipped, 'empty');
      continue;
    }
    result.notes.push({ title, body: withTagLine(markdown, tags), tags });
  }
  if (result.total === 0) result.invalid = true;
  return result;
}
