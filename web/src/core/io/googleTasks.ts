/**
 * Google Tasks export (Google Takeout → "Tasks" → `Tasks.json`):
 * `{ kind: 'tasks#taskLists', items: [{ title, items: [{ id, title, notes, due, status, completed,
 * parent, position, deleted }] }] }`. A single list object or a bare list of tasks is read as well.
 * Google stores the due day as midnight UTC, so the date part is the day.
 */
import { parseDateInput } from './dates';
import type { ImportedTask, ParsedTaskExport } from './taskImport';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isoDay = (v: unknown): string | undefined =>
  typeof v === 'string' ? parseDateInput(v.slice(0, 10)) : undefined;
const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function looksLikeTask(v: unknown): boolean {
  return isObject(v) && !Array.isArray(v.items) && ('title' in v || 'status' in v);
}

/** The lists of the file, whatever level the user exported at. */
function listsOf(root: unknown, fallbackName: string): { name: string; tasks: Json[] }[] {
  const entries = Array.isArray(root) ? root : isObject(root) ? [root] : [];
  const out: { name: string; tasks: Json[] }[] = [];
  const bare: Json[] = [];
  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const items = Array.isArray(entry.items) ? entry.items.filter(isObject) : [];
    if (items.some((i) => Array.isArray(i.items))) {
      // Top level is `tasks#taskLists`: its items are the lists.
      out.push(...listsOf(items, fallbackName));
    } else if (looksLikeTask(entry)) bare.push(entry);
    else out.push({ name: str(entry.title).trim() || fallbackName, tasks: items });
  }
  if (bare.length > 0) out.push({ name: fallbackName, tasks: bare });
  return out;
}

export function parseGoogleTasks(text: string, opts: { listName: string }): ParsedTaskExport {
  let root: unknown;
  try {
    root = JSON.parse(stripBom(text));
  } catch {
    return { tasks: [], skipped: 0 };
  }
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  // Bare task lists arrive one entry per list; merge them into one named after the file.
  const lists = listsOf(root, opts.listName);
  lists.forEach((list, listIndex) => {
    const raw = list.tasks
      .map((task, i) => ({ task, i }))
      .sort((a, b) => str(a.task.position).localeCompare(str(b.task.position)) || a.i - b.i)
      .map((x) => x.task);
    const byId = new Map<string, Json>();
    for (const task of raw) if (str(task.id)) byId.set(str(task.id), task);
    const key = (task: Json, i: number) => `g${listIndex}-${str(task.id) || i}`;
    const rootOf = (task: Json): Json | undefined => {
      let current = task;
      for (let depth = 0; depth < 10; depth++) {
        const parent = byId.get(str(current.parent));
        if (!parent) return depth === 0 ? undefined : current;
        current = parent;
      }
      return current;
    };
    raw.forEach((task, i) => {
      const title = str(task.title).trim();
      if (task.deleted === true || !title) {
        skipped++;
        return;
      }
      const top = rootOf(task);
      const done = str(task.status) === 'completed';
      const imported: ImportedTask = {
        key: key(task, i),
        title,
        priority: 0,
        done,
        list: list.name,
      };
      const notes = str(task.notes).trim();
      if (notes) imported.description = notes;
      const due = isoDay(task.due);
      if (due) imported.due = due;
      if (top && top !== task) imported.parentKey = key(top, raw.indexOf(top));
      tasks.push(imported);
    });
  });
  return { tasks, skipped };
}
