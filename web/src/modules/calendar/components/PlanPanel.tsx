/**
 * An appointment's panel under its blocker row in the planner (planner hub 2, package 9; hand-off 09): day · time · place,
 * and the things linked to it – `before` under A5 „Vorbereitung“, `after` under „Danach“ – as tick lines. They are
 * ToDos: read from the other end of the link (`useLinks`), ticked through `todo.doneRequested` inside one undoable
 * action with its own toast; calendar never imports ToDos. The foot is „Ganz öffnen“; „Vorbereiten …“ / „Danach …“
 * are the planner's, placed there by the host.
 *
 * `id` is the item the blocker came from (`<eventId>:<date>`, an occurrence of a series too): its day is that date.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useLinks } from '@/core/entitylinks';
import { bus } from '@/core/events';
import {
  PanelGone,
  PanelHead,
  PanelLoading,
  PanelText,
  PlanPanelFoot,
} from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { DATE_RE, formatDay } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Checkbox, PanelLine, PanelLines } from '@/ui';
import { eventRepo } from '../repo';
import { eventIdOf } from '../views';

/** The event and the day of the item; an id of another shape is the event itself on its own start day. */
function parts(id: string): { eventId: string; date?: string } {
  const date = id.slice(id.lastIndexOf(':') + 1);
  return DATE_RE.test(date) ? { eventId: eventIdOf(id), date } : { eventId: id };
}

/** Ticks a linked ToDo off: the ToDos module's own close, asked over the bus, inside one undoable action. */
async function tick(todoId: string): Promise<void> {
  const word = t.todos.markedDone;
  await undoableWithToast(word, word, () => bus.emit('todo.doneRequested', { id: todoId }));
}

export default function CalendarPlanPanel({ id }: PlanPanelProps) {
  const { eventId, date } = parts(id);
  // `null`: no live event of that id (deleted, never synced here, or a foreign id).
  const event = useLiveQuery(async () => (await eventRepo.get(eventId)) ?? null, [eventId]);
  const links = useLinks({ module: 'calendar', id: eventId });
  if (event === undefined) return <PanelLoading />;
  if (event === null) return <PanelGone />;
  const day = date ?? event.startDate;
  const time =
    event.startTime && event.endTime
      ? `${event.startTime}–${event.endTime}`
      : (event.startTime ?? undefined);
  const line = [formatDay(day, 'EEE, d. MMM'), time, event.location?.trim() || undefined]
    .filter(Boolean)
    .join(' · ');
  const linked = (rel: 'before' | 'after') =>
    (links ?? []).flatMap((l) =>
      l.direction === 'in' &&
      l.other.module === 'todos' &&
      l.link.rel === rel &&
      // A series: only this occurrence's things (a link without a day is the whole event's). A single event keeps its
      // things wherever it was moved.
      (!event.recurrence || !l.link.on || l.link.on === day) &&
      l.state.state === 'alive'
        ? [{ key: l.id, id: l.other.id, title: l.state.title, done: !!l.state.done }]
        : [],
    );
  const p = t.calendar.preparation;
  const group = (label: string, items: ReturnType<typeof linked>) =>
    items.length > 0 ? (
      <>
        <PanelHead>{label}</PanelHead>
        <PanelLines label={label}>
          {items.map((x) => (
            <PanelLine
              key={x.key}
              done={x.done}
              tick={
                <Checkbox
                  tone="neutral"
                  label={p.tick(x.title)}
                  labelHidden
                  checked={x.done}
                  // A done one stays as it is here: reopening is ToDos' own (its page).
                  disabled={x.done}
                  onChange={(e) => {
                    if (e.target.checked) void tick(x.id);
                  }}
                />
              }
            >
              {x.title}
            </PanelLine>
          ))}
        </PanelLines>
      </>
    ) : null;
  return (
    <>
      <PanelText kind="meta">{line}</PanelText>
      {group(p.label, linked('before'))}
      {group(p.after, linked('after'))}
      <PlanPanelFoot />
    </>
  );
}
