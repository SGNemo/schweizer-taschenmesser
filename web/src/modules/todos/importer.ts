import { parseLines } from '@/core/io/textLines';
import type { ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { ensureInbox, listRepo, taskRepo } from './repo';

const keyOf = (listId: string, title: string) => `${listId}|${title.trim().toLowerCase()}`;

const runtime: ImporterRuntime = {
  parse(_id, input, ctx) {
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
  async existingKeys() {
    const tasks = await taskRepo.active().toArray();
    return new Set(
      tasks.filter((task) => !task.done).map((task) => keyOf(task.listId, task.title)),
    );
  },
  async optionChoices(key) {
    if (key !== 'listId') return [];
    await ensureInbox(t.todos.inbox);
    const lists = (await listRepo.active().toArray()).sort((a, b) => a.order - b.order);
    return lists.map((list) => ({ value: list.id, label: list.name }));
  },
};

export default runtime;
