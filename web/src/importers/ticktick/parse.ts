/**
 * TickTick backup CSV (Settings → Account → Backup & Import → Generate backup). A few quoted
 * metadata lines ("Date: …", "Version: …", "Status: …") come before the header row
 * `"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date",
 * "Reminder","Repeat","Priority","Status",…,"Timezone","Is All Day",…,"taskId","parentId"`.
 * Times are UTC (`2026-03-14T23:00:00+0000`) and are read as days in the task's `Timezone`.
 * Priority 0/1/3/5 = none/low/medium/high; Status 0 = open, 1 = completed, 2 = archived.
 * Pure: no strings, no DOM, no database (runs in a Worker and in tests).
 */
import { parseCsv } from '@/core/io/csv';
import { parseRrule } from '@/core/io/ics';
import type { ImportedTask, ParsedTaskExport } from '@/core/io/taskImport';

const norm = (h: string) => h.trim().toLowerCase();

/** Index of the header row: it names a title, a list and a kind column. */
function headerIndex(rows: string[][]): number {
  return rows.findIndex((row, i) => {
    if (i > 20) return false;
    const keys = row.map(norm);
    return keys.includes('title') && keys.includes('list name') && keys.includes('kind');
  });
}

/** Looks only at the first lines: TickTick's preamble or its header. */
export function isTickTickCsv(text: string): boolean {
  const head = text.replace(/^\uFEFF/, '').slice(0, 4000);
  if (!/"?List Name"?\s*,\s*"?Title"?/i.test(head)) return false;
  return /"?Kind"?/i.test(head) && /"?Is All Day"?|"?taskId"?/i.test(head);
}

/** The calendar day of a UTC time stamp in the task's time zone (`YYYY-MM-DD`). */
export function dayIn(stamp: string, zone: string): string | undefined {
  const date = new Date(stamp.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const millis = (stamp: string) => new Date(stamp.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).getTime();

const PRIORITY: Record<string, ImportedTask['priority']> = { '5': 3, '3': 2, '1': 1 };

export function parseTickTickCsv(text: string, fallbackList = 'Inbox'): ParsedTaskExport {
  const rows = parseCsv(text, { delimiter: ',' });
  const at = headerIndex(rows);
  if (at < 0) return { tasks: [], skipped: 0 };
  const header = rows[at]!.map(norm);
  const col = (name: string) => header.indexOf(name);
  const get = (row: string[], name: string) => {
    const i = col(name);
    return i < 0 ? '' : (row[i] ?? '').trim();
  };

  const tasks: ImportedTask[] = [];
  let skipped = 0;
  const byId = new Map<string, ImportedTask>();
  const parentOf = new Map<string, string>();
  for (const row of rows.slice(at + 1)) {
    if (row.every((c) => !c.trim())) continue;
    const title = get(row, 'title');
    const kind = get(row, 'kind').toUpperCase();
    if (!title || kind === 'NOTE') {
      skipped++;
      continue;
    }
    const zone = get(row, 'timezone');
    const allDay = /^true$/i.test(get(row, 'is all day'));
    const start = get(row, 'start date');
    const dueStamp = get(row, 'due date') || start;
    const status = get(row, 'status');
    const task: ImportedTask = {
      key: get(row, 'taskid') || `k${tasks.length}`,
      title,
      priority: PRIORITY[get(row, 'priority')] ?? 0,
      done: status === '1' || status === '2',
      list: get(row, 'list name') || fallbackList,
    };
    const content = get(row, 'content');
    if (content) task.description = content;
    const due = dueStamp ? dayIn(dueStamp, zone) : undefined;
    if (due) task.due = due;
    const repeat = get(row, 'repeat');
    if (repeat) {
      const rule = parseRrule(repeat.replace(/^RRULE:/i, ''));
      if (rule) task.recurrence = rule;
      else task.dateHint = { text: repeat, recurring: true };
    }
    if (!allDay && start && get(row, 'due date')) {
      const minutes = Math.round((millis(get(row, 'due date')) - millis(start)) / 60000);
      if (minutes >= 1 && minutes <= 480) task.estimateMin = minutes;
    }
    const parent = get(row, 'parentid');
    if (parent) parentOf.set(task.key, parent);
    byId.set(task.key, task);
    tasks.push(task);
  }
  // One level of subtasks: a deeper task goes under its top-level ancestor.
  for (const task of tasks) {
    let parent = parentOf.get(task.key);
    for (let hops = 0; parent && parentOf.has(parent) && hops < 50; hops++)
      parent = parentOf.get(parent);
    if (parent && byId.has(parent) && parent !== task.key) task.parentKey = parent;
  }
  return { tasks, skipped };
}

/** Lists and open tasks, for the "recognised" line (counts only). */
export function summarizeTickTick(text: string): { lists: number; tasks: number } {
  const { tasks } = parseTickTickCsv(text);
  return { lists: new Set(tasks.map((t) => t.list)).size, tasks: tasks.length };
}
