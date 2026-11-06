import { detectTaskExport, parseTaskExport, type ImportedTask } from '@/core/io/taskImport';
import { parseLines } from '@/core/io/textLines';
import type { ImportCandidate, ImportParseResult, ImporterRuntime } from '@/core/importer/types';
import { describeRecurrence } from '@/core/recurrence/describe';
import { firstOnOrAfter } from '@/core/recurrence/expand';
import { relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { ensureInbox, listRepo, taskRepo } from './repo';

const keyOf = (listId: string, title: string) => `${listId}|${title.trim().toLowerCase()}`;
/** Completed tasks only ever match completed ones, so an open task of the same name stays distinct. */
const doneKeyOf = (listId: string, title: string) => `done|${keyOf(listId, title)}`;

/** Value of the target option that makes one list per source list. */
const PER_SOURCE = '@source';
/** The preview stays usable; bigger exports are cut with a note. */
const MAX_TASKS = 1000;

const baseName = (fileName: string) =>
  fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    // Todoist backups name each project file "Inbox [2290578498].csv".
    .replace(/\s*\[\d+\]$/, '')
    .trim();

/** Description plus the quiet hints about dates and repeats; nothing here repeats by itself. */
function noteOf(task: ImportedTask): string | undefined {
  const parts = [task.description ?? ''];
  if (task.dateHint) {
    parts.push(
      task.dateHint.recurring
        ? t.onboarding.todos.repeatNote(task.dateHint.text)
        : t.onboarding.todos.dueNote(task.dateHint.text),
    );
  }
  const note = parts.filter(Boolean).join('\n\n');
  return note || undefined;
}

async function parseFile(
  files: { name: string; text: string }[],
  ctx: Parameters<ImporterRuntime['parse']>[2],
): Promise<ImportParseResult> {
  // Several files (a Todoist ZIP: one CSV per project) make one preview; the file name names the list.
  const tasks: ImportedTask[] = [];
  let skippedOther = 0;
  let unknown = 0;
  for (const file of files) {
    const format = detectTaskExport(file.text);
    if (!format) {
      unknown++;
      continue;
    }
    const one = parseTaskExport(file.text, format, {
      listName: baseName(file.name) || t.todos.inbox,
      today: ctx.today,
    });
    // Keys are unique per file only.
    const prefix = `f${files.indexOf(file)}:`;
    for (const task of one.tasks)
      tasks.push({
        ...task,
        key: prefix + task.key,
        ...(task.parentKey ? { parentKey: prefix + task.parentKey } : {}),
      });
    skippedOther += one.skipped;
  }
  if (tasks.length === 0 && unknown > 0)
    return { candidates: [], notes: [t.onboarding.todos.unknownFormat] };
  const parsed = { tasks, skipped: skippedOther };
  const notes: string[] = [];
  if (unknown > 0) notes.push(t.importers.reasons.unreadable(unknown));

  const includeDone = ctx.options.includeDone === 'yes';
  const left = parsed.tasks.filter((task) => includeDone || !task.done);
  if (parsed.tasks.length > left.length) {
    notes.push(t.onboarding.todos.skippedDone(parsed.tasks.length - left.length));
  }
  if (parsed.skipped > 0) notes.push(t.onboarding.todos.skippedOther(parsed.skipped));
  const kept = left.slice(0, MAX_TASKS);
  if (left.length > kept.length) notes.push(t.onboarding.todos.tooMany(MAX_TASKS));
  const repeats = kept.filter((task) => task.dateHint?.recurring).length;
  if (repeats > 0) notes.push(t.onboarding.todos.repeats(repeats));
  const ruled = kept.filter((task) => task.recurrence).length;
  if (ruled > 0) notes.push(t.onboarding.todos.repeatsKept(ruled));

  const perSource = ctx.options.fileList === PER_SOURCE;
  const candidates: ImportCandidate[] = [];
  /** Source list name → id of the stored or newly proposed list. */
  const listIds = new Map<string, string>();
  /** Lists proposed in this import; their tasks depend on them. */
  const newListIds = new Set<string>();
  if (perSource) {
    const stored = await listRepo.active().toArray();
    let order = stored.reduce((max, list) => Math.max(max, list.order), 0);
    for (const name of new Set(kept.map((task) => task.list))) {
      const same = stored.find((list) => list.name.trim().toLowerCase() === name.toLowerCase());
      if (same) {
        listIds.set(name, same.id);
        continue;
      }
      const id = `imp-${ctx.batchId}-l${listIds.size}`;
      listIds.set(name, id);
      newListIds.add(id);
      candidates.push({
        collection: 'list',
        id,
        data: { name, order: ++order },
        label: name,
        detail: t.onboarding.todos.newList,
        dedupeKey: `list|${name.toLowerCase()}`,
      });
    }
  }

  const taskIds = new Map<string, string>();
  kept.forEach((task, n) => taskIds.set(task.key, `imp-${ctx.batchId}-t${n}`));
  const listOf = (task: ImportedTask) =>
    perSource ? listIds.get(task.list)! : (ctx.options.fileList ?? '');
  const dedupeOf = (task: ImportedTask) =>
    (task.done ? doneKeyOf : keyOf)(listOf(task), task.title);
  /** Stored tasks by duplicate key: a parent that is already there is not written again. */
  const storedIds = new Map<string, string>();
  for (const stored of await taskRepo.active().toArray()) {
    const key = (stored.done ? doneKeyOf : keyOf)(stored.listId, stored.title);
    if (!storedIds.has(key)) storedIds.set(key, stored.id);
  }
  const perList = new Map<string, number>();
  for (const task of kept) {
    const listId = listOf(task);
    const order = perList.get(listId) ?? 0;
    perList.set(listId, order + 1);
    const note = noteOf(task);
    // A subtask whose parent was left out (completed, cut) becomes a task of its own. A parent that
    // duplicates a stored task is that task; a new parent must be written with its subtask.
    const parent = task.parentKey ? kept.find((other) => other.key === task.parentKey) : undefined;
    const storedParent = parent ? storedIds.get(dedupeOf(parent)) : undefined;
    const newParent = parent && !storedParent ? taskIds.get(parent.key) : undefined;
    const parentId = storedParent ?? newParent;
    // A repeat counts from its due day; without one it starts at its first day from today on.
    const due =
      task.due ??
      (task.recurrence ? firstOnOrAfter(task.recurrence, ctx.today, ctx.today) : undefined);
    const data: Record<string, unknown> = {
      listId,
      title: task.title,
      done: task.done,
      priority: task.priority,
      order,
      ...(due ? { dueDate: due } : {}),
      ...(task.recurrence ? { recurrence: task.recurrence } : {}),
      ...(task.estimateMin ? { estimateMin: task.estimateMin } : {}),
      ...(note ? { note } : {}),
      ...(parentId ? { parentId } : {}),
    };
    // A new parent depends on the new list itself, so the subtask only needs its parent.
    const dependsOn = newParent ?? (newListIds.has(listId) ? listId : undefined);
    candidates.push({
      collection: 'task',
      id: taskIds.get(task.key),
      ...(dependsOn ? { dependsOn } : {}),
      data,
      label: task.title,
      detail:
        [
          perSource ? task.list : '',
          due ? relativeDayLabel(due, ctx.today) : '',
          task.recurrence ? describeRecurrence(task.recurrence) : '',
          task.estimateMin ? t.onboarding.todos.estimate(task.estimateMin) : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      dedupeKey: dedupeOf(task),
    });
  }
  return { candidates, notes };
}

const runtime: ImporterRuntime = {
  parse(_id, input, ctx) {
    if (input.kind === 'file')
      return parseFile(input.files ?? [{ name: input.fileName, text: input.text }], ctx);
    if (input.kind !== 'text') return { candidates: [], notes: [] };
    const listId = ctx.options.listId ?? '';
    return {
      candidates: parseLines(input.text, { max: 500 }).map((title) => ({
        collection: 'task',
        data: { listId, title },
        label: title,
        dedupeKey: keyOf(listId, title),
      })),
      notes: [],
    };
  },
  async existingKeys(collection) {
    if (collection === 'list') return new Set();
    const tasks = await taskRepo.active().toArray();
    return new Set(tasks.map((task) => (task.done ? doneKeyOf : keyOf)(task.listId, task.title)));
  },
  async optionChoices(key) {
    if (key !== 'listId' && key !== 'fileList') return [];
    await ensureInbox(t.todos.inbox);
    const lists = (await listRepo.active().toArray()).sort((a, b) => a.order - b.order);
    const choices = lists.map((list) => ({ value: list.id, label: list.name }));
    return key === 'fileList'
      ? [...choices, { value: PER_SOURCE, label: t.onboarding.todos.perSource }]
      : choices;
  },
};

export default runtime;
