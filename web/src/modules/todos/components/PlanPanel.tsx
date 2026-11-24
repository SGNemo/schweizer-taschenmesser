/**
 * A ToDo's panel under its plan row (planner hub 2, package 4a; hand-off 04): the note's first three lines and the
 * checklist as tick lines. „Erledigt“ is the row's own tick – the panel has none (two ways to finish would be one too
 * many). Every tick is ToDos' own write with ToDos' own undo toast; the planner writes nothing. Foot: „Ganz öffnen“.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { PanelGone, PanelLoading, PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Checkbox, PanelLine, PanelLines } from '@/ui';
import { taskRepo } from '../repo';
import type { ChecklistItem } from '../schema';
import styles from './PlanPanel.module.css';

/** Ticks one checklist line, ToDos' own write with its own undo; nothing when the line is gone meanwhile. */
export async function tickChecklist(taskId: string, itemId: string, done: boolean): Promise<void> {
  const task = await taskRepo.get(taskId);
  const item = task?.checklist?.find((c) => c.id === itemId);
  if (!task || !item || item.done === done) return;
  const message = done
    ? t.todos.checklist.ticked(item.text)
    : t.todos.checklist.reopened(item.text);
  await undoableWithToast(message, message, async () => {
    // Read again inside the action: a sync may have changed the other lines meanwhile.
    const fresh = await taskRepo.get(taskId);
    if (!fresh?.checklist) return;
    const checklist: ChecklistItem[] = fresh.checklist.map((c) =>
      c.id === itemId ? { ...c, done } : c,
    );
    await taskRepo.update(taskId, { checklist });
  });
}

export default function TodoPlanPanel({ id, compact }: PlanPanelProps) {
  // `null`: no live ToDo of that id (deleted, never synced here, or a foreign id).
  const task = useLiveQuery(async () => (await taskRepo.get(id)) ?? null, [id]);
  if (task === undefined) return <PanelLoading />;
  if (task === null) return <PanelGone />;
  const checklist = task.checklist ?? [];
  if (compact)
    return (
      <PanelLines>
        <PanelLine>{task.title}</PanelLine>
      </PanelLines>
    );
  return (
    <>
      {task.note ? <p className={styles.note}>{task.note}</p> : null}
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
