import type { ImportDates } from '@/core/db/repo';

/**
 * Markdown notes (Obsidian vaults, any `.md` file): optional front matter with `title` / `tags`, the
 * first heading as title, otherwise the file name. The text stays raw Markdown; `[[Wikilinks]]` are
 * not resolved. Tags found only in the front matter are written to the end of the text as `#tag`
 * (the notes model has no tag field).
 */
export interface ParsedNote {
  title: string;
  body: string;
  /** Without the leading `#`, in order of appearance, unique (case-insensitive). */
  tags: string[];
  pinned?: boolean;
  /** Top-level folder of a folder/ZIP import (Obsidian vault); becomes a notebook. */
  folder?: string;
  /** Epoch ms from the front matter (`created:`, else `date:`); see `noteDates` for the file date. */
  createdAt?: number;
  /** Epoch ms from the front matter (`modified:`, else `updated:`). */
  updatedAt?: number;
}

export interface PickedText {
  name: string;
  text: string;
}

const EXTENSION = /\.(?:md|markdown|txt)$/i;
const HEADING = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t#]*$/;
const FENCE = /^ {0,3}(?:```|~~~)/;
// A hashtag starts a word, holds letters/digits/_-/ and is not purely numeric ("#1", "#2024").
const TAG = /(?<![\p{L}\p{N}_&#/])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;

function unquote(v: string): string {
  const s = v.trim();
  return /^(["']).*\1$/s.test(s) && s.length >= 2 ? s.slice(1, -1).trim() : s;
}

function cleanTag(raw: string): string {
  return unquote(raw)
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '');
}

interface FrontMatter {
  title?: string;
  tags: string[];
  created?: number;
  modified?: number;
  /** Text after the closing line. */
  rest: string;
}

/** Only what notes need from the YAML block: `title`, `tags`/`tag` as list, inline list or comma text. */
function splitFrontMatter(text: string): FrontMatter {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { tags: [], rest: text };
  const end = lines.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(l));
  if (end < 0) return { tags: [], rest: text };
  // A note that merely starts with a horizontal rule is not front matter: every line of a real
  // block is blank, a `key:` (possibly indented) or a `- item`; anything else keeps the text whole.
  for (let i = 1; i < end; i++) {
    if (!/^\s*(?:$|[\w-]+\s*:|-\s)/.test(lines[i]!)) return { tags: [], rest: text };
  }
  const fm: FrontMatter = { tags: [], rest: lines.slice(end + 1).join('\n') };
  const dates: Record<string, number | undefined> = {};
  for (let i = 1; i < end; i++) {
    const d = /^(created|date|modified|updated)\s*:\s*(.*)$/i.exec(lines[i]!);
    if (d) {
      dates[d[1]!.toLowerCase()] ??= parseNoteDate(d[2]!);
      continue;
    }
    const m = /^(title|tags?)\s*:\s*(.*)$/i.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'title') {
      const title = unquote(value);
      if (title) fm.title = title;
      continue;
    }
    let items: string[];
    if (value === '' || value === '|' || value === '>') {
      items = [];
      while (i + 1 < end && /^\s*(?:-\s+|$)/.test(lines[i + 1]!)) {
        i++;
        const item = /^\s*-\s+(.*)$/.exec(lines[i]!);
        if (item) items.push(item[1]!);
      }
    } else if (value.startsWith('[')) {
      items = value.replace(/^\[|\]$/g, '').split(',');
    } else {
      items = value.split(/[,\s]+/);
    }
    for (const item of items) {
      const tag = cleanTag(item);
      if (tag) fm.tags.push(tag);
    }
  }
  fm.created = dates.created ?? dates.date;
  fm.modified = dates.modified ?? dates.updated;
  return fm;
}

const DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * A front matter date (`2025-12-01`, `2025-12-01 09:30`, `2025-12-01T09:30:00+01:00`) as epoch ms;
 * without a zone it is local time. Anything else (or an impossible date) is `undefined`.
 */
export function parseNoteDate(raw: string): number | undefined {
  const m = DATE.exec(unquote(raw));
  if (!m) return undefined;
  const [y, mo, d, h = '0', mi = '0', sec = '0'] = m.slice(1, 7);
  const parts = [y, mo, d, h, mi, sec].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const local = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  // 2025-02-31 rolls over to March: not a real date.
  if (
    local.getMonth() !== parts[1] - 1 ||
    local.getDate() !== parts[2] ||
    parts[3] > 23 ||
    parts[4] > 59 ||
    parts[5] > 59
  )
    return undefined;
  if (!m[7]) return local.getTime();
  const zoned = Date.parse(
    `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${sec.padStart(2, '0')}${m[7]}`,
  );
  return Number.isFinite(zoned) ? zoned : undefined;
}

function inlineTags(body: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const m of line.replace(/`[^`]*`/g, '').matchAll(TAG)) {
      if (/^\d+$/.test(m[1]!)) continue;
      out.push(m[1]!);
    }
  }
  return out;
}

function unique(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Appends `#tag` for tags the text does not mention yet. */
export function withTagLine(body: string, tags: string[]): string {
  const inText = new Set(inlineTags(body).map((tag) => tag.toLowerCase()));
  const missing = tags.filter((tag) => !inText.has(tag.toLowerCase()));
  if (missing.length === 0) return body;
  const line = missing.map((tag) => `#${tag.replace(/\s+/g, '-')}`).join(' ');
  return body.trim() === '' ? line : `${body.replace(/\s+$/, '')}\n\n${line}`;
}

/** `undefined` for an empty file (nothing but whitespace / empty front matter). */
export function parseMarkdownNote(raw: string, fileName = ''): ParsedNote | undefined {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fm = splitFrontMatter(text);
  let body = fm.rest.replace(/^\n+/, '').replace(/\s+$/, '');
  if (body.trim() === '') return undefined;

  let title = fm.title ?? '';
  if (!title) {
    const lines = body.split('\n');
    let fenced = false;
    for (let i = 0; i < lines.length; i++) {
      if (FENCE.test(lines[i]!)) fenced = !fenced;
      const h = !fenced ? HEADING.exec(lines[i]!) : null;
      if (!h) continue;
      title = h[1]!.trim();
      // A heading that opens the text is the title, not text: drop it so it does not appear twice.
      if (lines.slice(0, i).every((l) => l.trim() === '')) {
        body = lines
          .slice(i + 1)
          .join('\n')
          .replace(/^\n+/, '');
      }
      break;
    }
  }
  if (!title)
    title = fileName
      .replace(/^.*[\\/]/, '')
      .replace(EXTENSION, '')
      .trim();

  const tags = unique([...fm.tags, ...inlineTags(body)]);
  const note: ParsedNote = {
    title,
    body: withTagLine(body, fm.tags),
    tags,
    ...(fm.created !== undefined ? { createdAt: fm.created } : {}),
    ...(fm.modified !== undefined ? { updatedAt: fm.modified } : {}),
  };
  return note.title.trim() === '' && note.body.trim() === '' ? undefined : note;
}

export interface MarkdownNotesResult {
  notes: ParsedNote[];
  /** Files without any content. */
  empty: number;
}

export function parseMarkdownNotes(files: PickedText[]): MarkdownNotesResult {
  const notes: ParsedNote[] = [];
  let empty = 0;
  for (const file of files) {
    const note = parseMarkdownNote(file.text, file.name);
    if (note) notes.push(note);
    else empty++;
  }
  return { notes, empty };
}

/**
 * The dates an imported note keeps: the front matter first, the file's own date (ZIP entry, file
 * system) for whatever is missing – but never a `createdAt` after a known `modified:` (a copied
 * file is often younger than its text). `undefined` when nothing is known (pasted text).
 */
export function noteDates(
  note: Pick<ParsedNote, 'createdAt' | 'updatedAt'>,
  fileDate?: number,
): ImportDates | undefined {
  const updatedAt = note.updatedAt ?? fileDate;
  const createdAt =
    note.createdAt ??
    (note.updatedAt !== undefined && fileDate !== undefined
      ? Math.min(note.updatedAt, fileDate)
      : (note.updatedAt ?? fileDate));
  if (createdAt === undefined) return undefined;
  return updatedAt === undefined ? { createdAt } : { createdAt, updatedAt };
}
