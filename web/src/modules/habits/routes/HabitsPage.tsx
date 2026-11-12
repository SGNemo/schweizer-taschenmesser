import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useWeekStart } from '@/core/settings/core';
import { addDaysStr, formatDay, today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  DetailPanel,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  SplitView,
  Tabs,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { GoalCard } from '../components/GoalCard';
import { GoalEditor, type GoalTarget } from '../components/GoalEditor';
import { HabitsMotif } from '../components/HabitsMotif';
import { GoalHistory, History } from '../components/History';
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
  // Master–detail (layout `split`): on a wide page the picked goal's history lies in the panel beside today's list.
  const wide = useSplitView();
  const [picked, setPicked] = useState<string | 'closed' | null>(null);
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
  // The panel shows the picked goal, else the first of today's list.
  const detail =
    !wide || picked === 'closed' || view !== 'today'
      ? undefined
      : (planned.find((g) => g.id === picked) ?? planned[0]);
  return (
    <>
      <PageHeader
        title={t.habits.title}
        views={
          <Tabs
            label={t.habits.tabs.label}
            value={view}
            options={VIEWS.map((v) => ({ value: v, label: t.habits.tabs[v] }))}
            onChange={setView}
          />
        }
      >
        {/* U26: while there is nothing, the empty state holds the one filled step. */}
        <PageAction
          short={t.habits.meta.quickAdd}
          variant={goals && goals.length === 0 && view !== 'archive' ? 'secondary' : 'primary'}
          onClick={() => setTarget('new')}
        >
          <Icon name="plus" size={18} />
          {t.habits.add}
        </PageAction>
      </PageHeader>
      {goals && planned.length > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            label={t.habits.tabs.today}
            value={String(planned.filter((g) => dayProgress(g, todayMap.get(g.id)) >= 1).length)}
            unit={`/ ${planned.length}`}
            // The standard head draws no label: the context line names the number.
            detail={t.habits.tabs.today}
            testId="habit-done"
          />
        </HeroSlot>
      ) : null}
      {goals && goals.length === 0 && view !== 'archive' ? (
        <EmptyState title={t.habits.empty} testId="habits-empty" motif={<HabitsMotif />}>
          <Button variant="primary" onClick={() => setTarget('new')}>
            {t.habits.addFirst}
          </Button>
        </EmptyState>
      ) : null}

      {view === 'today' && goals && goals.length > 0 ? (
        planned.length === 0 ? (
          <p>{t.habits.today.nothing}</p>
        ) : (
          <SplitView
            enabled={detail !== undefined}
            asideLabel={t.habits.detail.label}
            aside={
              detail ? (
                <DetailPanel
                  testId="habit-detail"
                  eyebrow={t.habits.meta.quickAdd}
                  title={detail.name}
                  onClose={() => setPicked('closed')}
                  actions={
                    <Button onClick={() => setTarget(detail)} data-row-edit>
                      {t.actions.edit}
                    </Button>
                  }
                >
                  <GoalHistory
                    goal={detail}
                    entries={entries ?? []}
                    weekStart={weekStart}
                    compact
                  />
                </DetailPanel>
              ) : null
            }
          >
            {/* The day the list is about; on the phone it is the page's first line. */}
            <p className={styles.dayLine}>{formatDay(day, 'EEEE, d. MMMM')}</p>
            <ul className={styles.cards} aria-label={t.habits.tabs.today}>
              {planned.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  entry={todayMap.get(g.id)}
                  map={byGoal.get(g.id) ?? new Map()}
                  day={day}
                  weekStart={weekStart}
                  onEdit={() => setTarget(g)}
                  current={detail?.id === g.id}
                  onPick={wide ? () => setPicked(g.id) : undefined}
                />
              ))}
            </ul>
          </SplitView>
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
