import { useEffect, useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { undoable } from '@/core/undo';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Ring, RowMenu, type RowMenuItem } from '@/ui';
import { dailyTarget, dayProgress, weekDone } from '../logic';
import { archiveGoal, bump, setEntry } from '../repo';
import type { Entry, Goal } from '../schema';
import styles from '../habits.module.css';

type StoredGoal = Stored<Goal>;

/**
 * One goal today: a ring (percent of the day's target, the count inside), the name, the progress
 * as words, and the one action ("+1" for a number, "Erledigt" for a tick). Taps are silent (Ctrl+Z
 * undoes them), so a glass of water never raises a toast. A rest day greys the card and counts for nothing.
 */
export function GoalCard({
  goal,
  entry,
  map,
  day,
  weekStart,
  onEdit,
  current = false,
  onPick,
}: {
  goal: StoredGoal;
  entry: Entry | undefined;
  map: ReadonlyMap<string, Entry>;
  day: string;
  weekStart: 1 | 7;
  onEdit: () => void;
  /** Master–detail (wide page): this goal is the one shown in the panel, and the way to show it there. */
  current?: boolean;
  onPick?: () => void;
}) {
  const [popped, setPopped] = useState(false);
  const [menu, setMenu] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The pop animation ends on a timer; a card that goes away before it fires must not set state afterwards.
  useEffect(() => () => clearTimeout(popTimer.current), []);
  const count = entry?.count ?? 0;
  const target = dailyTarget(goal);
  const rest = Boolean(entry?.skipped) && count === 0;
  const percent = Math.round(dayProgress(goal, entry) * 100);
  const isCount = goal.kind === 'count';

  const pop = () => {
    setPopped(true);
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopped(false), 250);
  };
  const silent = (label: string, fn: () => Promise<void>) => void undoable(label, fn);

  const items: RowMenuItem[] = [
    { id: 'edit', label: t.actions.edit, onSelect: onEdit },
    rest
      ? {
          id: 'rest-off',
          label: t.habits.today.restOff,
          onSelect: () =>
            silent(goal.name, () =>
              setEntry(goal.id, day, { skipped: undefined }).then(() => undefined),
            ),
        }
      : {
          id: 'rest',
          label: t.habits.today.rest,
          onSelect: () =>
            silent(goal.name, () =>
              setEntry(goal.id, day, { count: 0, skipped: true }).then(() => undefined),
            ),
        },
    ...(isCount && count > 0
      ? [
          {
            id: 'minus',
            label: t.habits.today.minusFor(goal.name),
            onSelect: () => silent(goal.name, () => bump(goal.id, day, -1)),
          },
        ]
      : []),
    {
      id: 'archive',
      label: t.habits.archive.archiveAction,
      onSelect: () =>
        void changeWithUndo(() => archiveGoal(goal.id, true), t.habits.archive.archived),
    },
  ];

  const week = goal.period === 'week' ? weekDone(goal, map, day, weekStart) : undefined;
  const progressText = rest
    ? t.habits.today.restOn
    : isCount
      ? t.habits.today.progress(count, target, goal.unit)
      : count >= 1
        ? t.habits.today.done
        : '';

  return (
    <li
      className={`${styles.card} ${rest ? styles.cardRest : ''} ${current ? styles.cardCurrent : ''}`}
      data-testid="habit-card"
    >
      <span className={`${styles.ringHue} ${popped ? styles.pop : ''}`}>
        <Ring percent={percent} size="md" label={goal.name}>
          {isCount ? count : count >= 1 ? '✓' : ''}
        </Ring>
      </span>
      {onPick ? (
        // Wide page: the name and its line are the row's button, it shows the goal's history in the panel.
        <button
          type="button"
          className={styles.pick}
          data-row
          aria-current={current ? 'true' : undefined}
          onClick={onPick}
        >
          <span className={styles.name}>{goal.name}</span>
          <span className={styles.meta}>
            {[progressText, week ? t.habits.today.weekProgress(week.done, week.of) : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </button>
      ) : (
        <div>
          <p className={styles.name}>{goal.name}</p>
          <p className={styles.meta}>
            {[progressText, week ? t.habits.today.weekProgress(week.done, week.of) : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}
      <div className={styles.actions}>
        {isCount ? (
          // U09: a card action is a quiet everyday tap; the page head keeps the one filled button.
          <Button
            variant="secondary"
            size="sm"
            aria-label={t.habits.today.plusFor(goal.name)}
            onClick={() => {
              pop();
              silent(goal.name, () => bump(goal.id, day, 1));
            }}
          >
            {t.habits.today.plus}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={count >= 1}
            aria-label={`${goal.name}: ${count >= 1 ? t.habits.today.undo : t.habits.today.markDone}`}
            onClick={() => {
              if (count < 1) pop();
              silent(goal.name, () =>
                setEntry(goal.id, day, { count: count >= 1 ? 0 : 1, skipped: undefined }).then(
                  () => undefined,
                ),
              );
            }}
          >
            {count >= 1 ? t.habits.today.undo : t.habits.today.markDone}
          </Button>
        )}
        <RowMenu label={goal.name} open={menu} onOpenChange={setMenu} items={items} />
      </div>
    </li>
  );
}
