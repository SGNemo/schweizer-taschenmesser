import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { undoable } from '@/core/undo';
import { t } from '@/strings';
import { Button, FortschrittBody, WidgetBody } from '@/ui';
import { dailyTarget, dayState, isScheduled } from '../logic';
import { entryRepo, goalRepo, bump, entryId, setEntry } from '../repo';

/** Today's rings (`FortschrittBody` rings, G10: the same shape as the head), and one tap for the first open goal ("+1 Wasser trinken"). */
export default function HabitsWidget() {
  const day = today();
  const data = useLiveQuery(async () => {
    const goals = (await goalRepo.active().sortBy('order')).filter(
      (g) => !g.archived && isScheduled(g, day),
    );
    const entries = new Map(
      (await Promise.all(goals.map((g) => entryRepo.get(entryId(g.id, day))))).flatMap((e) =>
        e ? [[e.goalId, e] as const] : [],
      ),
    );
    return { goals, entries };
  }, [day]);
  const goals = data?.goals ?? [];
  const entries = data?.entries;
  const done = goals.filter((g) => dayState(g, entries?.get(g.id), day) === 'done').length;
  const next = goals.find((g) => {
    const s = dayState(g, entries?.get(g.id), day);
    return s === 'open' || s === 'partial';
  });
  return (
    <>
      <WidgetBody
        loading={!data}
        isEmpty={goals.length === 0}
        empty={t.habits.widget.empty}
        emptyAction={{ label: t.habits.widget.addAction, to: '/habits?new=1' }}
      >
        <FortschrittBody
          kind="rings"
          summary={goals.length ? t.habits.widget.summary(done, goals.length) : undefined}
          entries={goals.map((g) => ({
            key: g.id,
            title: g.name,
            value: Math.min(entries?.get(g.id)?.count ?? 0, dailyTarget(g)),
            max: dailyTarget(g),
            detail:
              g.kind === 'count'
                ? t.habits.widget.detail(entries?.get(g.id)?.count ?? 0, g.target, g.unit)
                : (entries?.get(g.id)?.count ?? 0) >= 1
                  ? t.habits.today.done
                  : '',
          }))}
        />
      </WidgetBody>
      {next ? (
        <Button
          size="sm"
          onClick={() =>
            void undoable(next.name, () =>
              next.kind === 'count'
                ? bump(next.id, day, 1)
                : setEntry(next.id, day, { count: 1, skipped: undefined }).then(() => undefined),
            )
          }
        >
          {next.kind === 'count'
            ? t.habits.widget.plusFor(next.name)
            : `${next.name}: ${t.habits.today.markDone}`}
        </Button>
      ) : null}
    </>
  );
}
