import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  ItemList,
  PageHeader,
  patternStyles,
} from '@/ui';
import { HabitEditor, type HabitTarget } from '../components/HabitEditor';
import { completionRate, doneByHabit, isScheduled, recentDays, streak } from '../logic';
import { checkRepo, habitRepo, setChecked } from '../repo';

export default function HabitsPage() {
  const habits = useLiveQuery(
    async () => (await habitRepo.active().toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );
  const checks = useLiveQuery(() => checkRepo.active().toArray(), []);
  const [target, setTarget] = useState<HabitTarget>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const done = doneByHabit(checks ?? []);
  const visible = (habits ?? []).filter((h) => showArchived || !h.archived);
  const hasArchived = (habits ?? []).some((h) => h.archived);

  return (
    <>
      <PageHeader title={t.habits.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.habits.add}
        </Button>
      </PageHeader>
      {habits && visible.length === 0 ? <EmptyState icon="flame" title={t.habits.empty} /> : null}
      <ItemList label={t.habits.title}>
        {visible.map((h) => {
          const set = done.get(h.id) ?? new Set<string>();
          const rate = completionRate(h, set, day);
          return (
            <Card as="li" key={h.id}>
              <div className={patternStyles.row}>
                <div style={{ flex: 1, minWidth: '10rem' }}>
                  {isScheduled(h, day) ? (
                    <Checkbox
                      label={<strong>{h.name}</strong>}
                      checked={set.has(day)}
                      onChange={(e) => void setChecked(h.id, day, e.target.checked)}
                    />
                  ) : (
                    <strong>{h.name}</strong>
                  )}
                  <span className={patternStyles.muted} data-testid={`streak-${h.name}`}>
                    {t.habits.streak(streak(h, set, day))}
                    {rate !== undefined ? ` · ${t.habits.rate(rate)}` : ''}
                    {h.archived ? ` · ${t.habits.archived}` : ''}
                  </span>
                </div>
                <div className={patternStyles.chips} role="group" aria-label={t.habits.lastDays}>
                  {recentDays(h, set, day).map((c) => (
                    <button
                      key={c.date}
                      type="button"
                      disabled={!c.scheduled}
                      aria-pressed={c.done}
                      aria-label={`${h.name}, ${formatDay(c.date, 'EEEE, d. MMMM')}`}
                      onClick={() => void setChecked(h.id, c.date, !c.done)}
                      className={patternStyles.chip}
                      style={{ minWidth: 44 }}
                    >
                      {formatDay(c.date, 'EEEEEE')}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" onClick={() => setTarget(h)}>
                  {t.actions.edit}
                </Button>
              </div>
            </Card>
          );
        })}
      </ItemList>
      {hasArchived ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? t.habits.hideArchived : t.habits.showArchived}
          </Button>
        </div>
      ) : null}
      <HabitEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
