import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useWeekStart } from '@/core/settings/core';
import { addDaysStr, today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Icon, ItemList, ItemRow, PageHeader, Segmented, useOpenParam } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { GoalCard } from '../components/GoalCard';
import { GoalEditor, type GoalTarget } from '../components/GoalEditor';
import { HabitsEmpty } from '../components/HabitsEmpty';
import { HabitRings } from '../components/HabitRings';
import { History } from '../components/History';
import { useEntries, useGoals } from '../data';
import { dayProgress, isScheduled } from '../logic';
import { archiveGoal, goalRepo } from '../repo';
import type { Entry } from '../schema';
import styles from '../habits.module.css';

const VIEWS = ['today', 'history', 'archive'] as const;
type View = (typeof VIEWS)[number];

export default function HabitsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: View = (VIEWS as readonly string[]).includes(raw ?? '') ? (raw as View) : 'today';
  const goals = useGoals(false);
  const archived = useGoals(true);
  const day = today();
  // A year of entries for the grid; the today view only reads the current days from them.
  const entries = useEntries(addDaysStr(day, -371));
  const weekStart = useWeekStart();
  const [target, setTarget] = useState<GoalTarget>(null);
  useOpenParam(
    (id) => goalRepo.get(id),
    (g) => setTarget(g),
  );

  // `?new=1` (Quick-Add) opens the editor; closing it drops the parameter.
  const openTarget: GoalTarget = target ?? (params.get('new') ? 'new' : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };

  const todayMap = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries ?? []) if (e.date === day) map.set(e.goalId, e);
    return map;
  }, [entries, day]);
  const byGoal = useMemo(() => {
    const map = new Map<string, Map<string, Entry>>();
    for (const e of entries ?? []) {
      const m = map.get(e.goalId) ?? new Map<string, Entry>();
      m.set(e.date, e);
      map.set(e.goalId, m);
    }
    return map;
  }, [entries]);

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'today') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  const planned = (goals ?? []).filter((g) => isScheduled(g, day));
  return (
    <>
      <PageHeader
        title={t.habits.title}
        views={
          <Segmented
            label={t.habits.tabs.label}
            value={view}
            options={VIEWS.map((v) => ({ value: v, label: t.habits.tabs[v] }))}
            onChange={setView}
          />
        }
      >
        <Button variant="primary" onClick={() => setTarget('new')}>
          <Icon name="plus" size={18} />
          {t.habits.add}
        </Button>
      </PageHeader>
      {goals && planned.length > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            value={String(planned.filter((g) => dayProgress(g, todayMap.get(g.id)) >= 1).length)}
            unit={`/ ${planned.length}`}
            testId="habit-done"
          />
        </HeroSlot>
      ) : null}
      {goals ? (
        <HeroSlot>
          <HabitRings goals={goals} today={todayMap} day={day} />
        </HeroSlot>
      ) : null}

      {goals && goals.length === 0 && view !== 'archive' ? (
        <HabitsEmpty title={t.habits.empty}>
          <p>{t.habits.emptyHint}</p>
          <Button variant="primary" onClick={() => setTarget('new')}>
            {t.habits.add}
          </Button>
        </HabitsEmpty>
      ) : null}

      {view === 'today' && goals && goals.length > 0 ? (
        planned.length === 0 ? (
          <p>{t.habits.today.nothing}</p>
        ) : (
          <ul className={styles.cards}>
            {planned.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                entry={todayMap.get(g.id)}
                map={byGoal.get(g.id) ?? new Map()}
                day={day}
                weekStart={weekStart}
                onEdit={() => setTarget(g)}
              />
            ))}
          </ul>
        )
      ) : null}

      {view === 'history' && goals && goals.length > 0 ? (
        <History goals={goals} entries={entries ?? []} weekStart={weekStart} />
      ) : null}

      {view === 'archive' ? (
        archived && archived.length === 0 ? (
          <p>{t.habits.archive.empty}</p>
        ) : (
          <ItemList>
            {(archived ?? []).map((g) => (
              <ItemRow
                key={g.id}
                title={g.name}
                onOpen={() => setTarget(g)}
                end={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void changeWithUndo(() => archiveGoal(g.id, false), t.habits.archive.restored)
                    }
                  >
                    {t.habits.archive.restoreAction}
                  </Button>
                }
              />
            ))}
          </ItemList>
        )
      ) : null}

      <GoalEditor target={openTarget} nextOrder={(goals?.length ?? 0) + 1} onClose={closeEditor} />
    </>
  );
}
