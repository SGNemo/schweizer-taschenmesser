import { withTagLine, type ParsedNote } from './markdownNote';

/**
 * Google Keep from Google Takeout: one JSON object per note (`title`, `textContent`, `listContent`,
 * `labels`, `isTrashed`, `isArchived`, `isPinned` …); a file may also hold an array of them.
 * Trashed and archived notes are left out. The note keeps its own dates (`createdTimestampUsec`,
 * `userEditedTimestampUsec`, microseconds), like a Markdown note's front matter (D17).
 * Checklists become Markdown task lists, labels become `#tags` at the end of the text.
 */
export interface KeepResult {
  notes: ParsedNote[];
  /** Notes in the trash or the archive. */
  skipped: number;
  /** Notes without title and text. */
  empty: number;
  /** Attached images, audio and files (not stored). */
  attachments: number;
  /** The JSON is unreadable or not a Keep note. */
  invalid: boolean;
}

interface KeepNote {
  title?: unknown;
  textContent?: unknown;
  listContent?: unknown;
  labels?: unknown;
  isTrashed?: unknown;
  isArchived?: unknown;
  isPinned?: unknown;
  attachments?: unknown;
  createdTimestampUsec?: unknown;
  userEditedTimestampUsec?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Keep's microseconds (a number, in some exports a string) as epoch ms; nothing for a missing or broken value. */
function usecToMs(v: unknown): number | undefined {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : undefined;
}
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Looks like a Keep note, not just any JSON object. */
const isKeepNote = (v: unknown): v is KeepNote =>
  isObject(v) && ('textContent' in v || 'listContent' in v || 'title' in v);

function listMarkdown(list: unknown): string {
  if (!Array.isArray(list)) return '';
  const lines: string[] = [];
  for (const item of list) {
    if (!isObject(item)) continue;
    const text = str(item.text).trim();
    if (text) lines.push(`- [${item.isChecked === true ? 'x' : ' '}] ${text}`);
  }
  return lines.join('\n');
}

export function parseGoogleKeep(json: string): KeepResult {
  const result: KeepResult = { notes: [], skipped: 0, empty: 0, attachments: 0, invalid: false };
  let data: unknown;
  try {
    data = JSON.parse(json.replace(/^\uFEFF/, ''));
  } catch {
    return { ...result, invalid: true };
  }
  const entries = Array.isArray(data) ? data : [data];
  if (!entries.some(isKeepNote)) return { ...result, invalid: true };

  for (const entry of entries) {
    if (!isKeepNote(entry)) continue;
    if (entry.isTrashed === true || entry.isArchived === true) {
      result.skipped++;
      continue;
    }
    if (Array.isArray(entry.attachments)) result.attachments += entry.attachments.length;
    const text = str(entry.textContent).replace(/\r\n?/g, '\n').trim();
    const list = listMarkdown(entry.listContent);
    const tags = Array.isArray(entry.labels)
      ? entry.labels
          .map((l) =>
            isObject(l) ? str(l.name).trim().replace(/^#+/, '').replace(/\s+/g, '-') : '',
          )
          .filter(Boolean)
      : [];
    const title = str(entry.title).trim();
    const body = [text, list].filter(Boolean).join('\n\n');
    if (title === '' && body === '') {
      result.empty++;
      continue;
    }
    const note: ParsedNote = { title, body: withTagLine(body, tags), tags };
    if (entry.isPinned === true) note.pinned = true;
    const createdAt = usecToMs(entry.createdTimestampUsec);
    const updatedAt = usecToMs(entry.userEditedTimestampUsec);
    if (createdAt !== undefined) note.createdAt = createdAt;
    if (updatedAt !== undefined) note.updatedAt = updatedAt;
    result.notes.push(note);
  }
  return result;
}
