/**
 * A ToDo's panel under its plan row (planner hub 2, package 4a; hand-off 04): the note's first three lines and the
 * checklist as tick lines. „Erledigt“ is the row's own tick – the panel has none (two ways to finish would be one too
 * many). Every tick is ToDos' own write with ToDos' own undo toast; the planner writes nothing. Foot: „Ganz öffnen“.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PanelDefaultBody,
  PanelGone,
  PanelLoading,
  PanelNote,
  PlanPanelFoot,
} from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Checkbox, PanelLine, PanelLines } from '@/ui';
import { setDone, taskRepo } from '../repo';
import type { ChecklistItem } from '../schema';

/** Sets one checklist line, read fresh: a sync may have changed the other lines meanwhile. */
async function setLine(taskId: string, itemId: string, done: boolean): Promise<void> {
  const fresh = await taskRepo.get(taskId);
  if (!fresh?.checklist?.some((c) => c.id === itemId && c.done !== done)) return;
  const checklist: ChecklistItem[] = fresh.checklist.map((c) =>
    c.id === itemId ? { ...c, done } : c,
  );
  await taskRepo.update(taskId, { checklist });
}

/**
 * Ticks one checklist line: ToDos' own write with its own undo toast. The undo flips only this line back (the field
 * holds the whole list, and restoring it would also undo a line ticked elsewhere since); nothing when the line is gone.
 */
export async function tickChecklist(taskId: string, itemId: string, done: boolean): Promise<void> {
  const task = await taskRepo.get(taskId);
  const item = task?.checklist?.find((c) => c.id === itemId);
  if (!task || !item || item.done === done) return;
  const message = done
    ? t.todos.checklist.ticked(item.text)
    : t.todos.checklist.reopened(item.text);
  await undoableWithToast(
    message,
    message,
    () => setLine(taskId, itemId, done),
    () => setLine(taskId, itemId, !done),
  );
}

export default function TodoPlanPanel({ id, compact }: PlanPanelProps) {
  // `null`: no live ToDo of that id (deleted, never synced here, or a foreign id).
  const task = useLiveQuery(async () => (await taskRepo.get(id)) ?? null, [id]);
  if (task === undefined) return <PanelLoading />;
  if (task === null) return <PanelGone />;
  const checklist = task.checklist ?? [];
  // A member line in a pile (package 2): the title and its tick – the ToDo's own „Erledigt“ with its undo toast.
  if (compact)
    return (
      <PanelLines>
        <PanelLine
          done={task.done}
          tick={
            <Checkbox
              tone="neutral"
              label={t.planner.row.doneName(task.title)}
              labelHidden
              checked={!!task.done}
              onChange={(e) => {
                const done = e.target.checked;
                const word = done ? t.todos.markedDone : t.todos.markedOpen;
                void undoableWithToast(word, word, () => setDone(task, done));
              }}
            />
          }
        >
          {task.title}
        </PanelLine>
      </PanelLines>
    );
  return (
    <>
      {task.note ? <PanelNote>{task.note}</PanelNote> : null}
      {/* No checklist (the common plain ToDo): what the row knows – its detail and links – as the default. */}
      {checklist.length === 0 ? <PanelDefaultBody /> : null}
      {checklist.length > 0 ? (
        <PanelLines label={t.todos.checklist.title}>
          {checklist.map((c) => (
            <PanelLine
              key={c.id}
              done={c.done}
              tick={
                <Checkbox
                  tone="neutral"
                  label={t.planner.panel.tick(c.text)}
                  labelHidden
                  checked={c.done}
                  onChange={(e) => void tickChecklist(task.id, c.id, e.target.checked)}
                />
              }
            >
              {c.text}
            </PanelLine>
          ))}
        </PanelLines>
      ) : null}
      <PlanPanelFoot />
    </>
  );
}
