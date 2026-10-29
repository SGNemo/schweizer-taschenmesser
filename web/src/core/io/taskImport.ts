/**
 * Shared shape of task exports from other apps (Todoist CSV, Google Tasks JSON) and the detection of
 * which one a chosen file is. Pure functions; the todos importer turns the result into candidates.
 */
import { parseTodoistCsv } from './todoistCsv';
import { parseGoogleTasks } from './googleTasks';

export interface ImportedTask {
  /** Unique within the file; `parentKey` points at it. */
  key: string;
  title: string;
  description?: string;
  /** App scale: 0 = none … 3 = high. */
  priority: 0 | 1 | 2 | 3;
  /** 'YYYY-MM-DD' when the export holds a real calendar day. */
  due?: string;
  /** Date text that is not a calendar day ("every Monday", "tomorrow"); only ever shown as a hint. */
  dateHint?: { text: string; recurring: boolean };
  done: boolean;
  /** One level only: deeper levels are attached to their top-level task. */
  parentKey?: string;
  /** Name of the source list (Google: list title; Todoist: set by the caller from the file name). */
  list: string;
}

export interface ParsedTaskExport {
  tasks: ImportedTask[];
  /** Entries the export had but that are not tasks (sections, deleted, empty titles). */
  skipped: number;
}

export type TaskExportFormat = 'todoist' | 'google';

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** Looks at the content, not the file name: JSON starts with `{`/`[`, Todoist CSV has TYPE + CONTENT. */
export function detectTaskExport(text: string): TaskExportFormat | undefined {
  const src = stripBom(text).trimStart();
  if (src.startsWith('{') || src.startsWith('[')) return 'google';
  const header = (src.split(/\r?\n/, 1)[0] ?? '').toUpperCase();
  return /\bTYPE\b/.test(header) && /\bCONTENT\b/.test(header) ? 'todoist' : undefined;
}

export function parseTaskExport(
  text: string,
  format: TaskExportFormat,
  opts: { listName: string; today?: string },
): ParsedTaskExport {
  return format === 'google' ? parseGoogleTasks(text, opts) : parseTodoistCsv(text, opts);
}
