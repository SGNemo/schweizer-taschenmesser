import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { usePlannable } from '@/core/modules/contributions';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Card, ItemList, ItemRow } from '@/ui';
import { markDone, skipPassed } from '../actions';
import { passedFixed, passedWindow } from '../passed';
import { itemRepo } from '../repo';
import styles from '../routes/planner.module.css';

/**
 * „Training vom Sa – eintragen?“ under today's sheet (`passed.ts`): a training with a time whose day passed unlogged,
 * once, recessed, without a count or a tone. „Eintragen“ logs it through its source (`onDone`, as the fitness page's
 * „Erledigt“), „Weglassen“ lets it go; both undoable. No such training, no card.
 */
export function PassedTrainings({
  today,
  titles,
}: {
  today: string;
  titles: Record<string, string>;
}) {
  const navigate = useNavigate();
  const span = useMemo(() => passedWindow(today), [today]);
  const entries = usePlannable(span);
  const rows = useLiveQuery(() => itemRepo.active().toArray(), []);
  const passed = entries && rows ? passedFixed(entries, rows, today) : [];
  if (passed.length === 0) return null;
  return (
    <Card className={styles.sheet} data-testid="planner-passed">
      <ItemList label={t.planner.passed.label}>
        {passed.map(({ entry, date, from }) => {
          const day = formatDay(date, 'EEE, d. MMM');
          return (
            <ItemRow
              key={entry.id}
              recessed
              title={t.planner.passed.ask(day)}
              meta={`${entry.title} · ${from}`}
              onOpen={() => void navigate(entry.to)}
              end={
                <span className={styles.passedActions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={t.planner.passed.logFor(day)}
                    onClick={() => void markDone(entry, titles)}
                  >
                    {t.planner.passed.log}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t.planner.passed.skipFor(day)}
                    onClick={() => void skipPassed(entry, date, titles)}
                  >
                    {t.planner.passed.skip}
                  </Button>
                </span>
              }
            />
          );
        })}
      </ItemList>
    </Card>
  );
}
