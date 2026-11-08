import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMinutes } from '@/core/i18n/format';
import { useWeekStart } from '@/core/settings/core';
import { addDaysStr, relativeDayLabel, today } from '@/core/time/dates';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  Segmented,
  useOpenParam,
} from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { GoalDialog } from '../components/GoalDialog';
import { MealEditor, type MealTarget } from '../components/MealEditor';
import { SessionEditor, type SessionTarget } from '../components/SessionEditor';
import { WeekView } from '../components/WeekView';
import {
  exerciseDetail,
  kcalLine,
  kcalText,
  sessionTitle,
  useFitnessSettings,
  useMeals,
  useSessions,
  useTemplates,
} from '../data';
import {
  byDay,
  daySum,
  doneToday,
  isAhead,
  isLogged,
  latestSession,
  repeatSession,
  sessionMinutes,
  weekOf,
  weekSummary,
} from '../logic';
import { mealRepo, sessionRepo } from '../repo';
import type { Session } from '../schema';
import styles from '../fitness.module.css';

type View = 'training' | 'food' | 'week';
/** How far back the lists and the week view go; older entries stay stored. */
const WINDOW_DAYS = 90;

export default function FitnessPage() {
  const [params, setParams] = useSearchParams();
  const prefs = useFitnessSettings();
  const raw = params.get('view');
  const view: View =
    raw === 'food' && prefs.nutrition ? 'food' : raw === 'week' ? 'week' : 'training';
  const day = today();
  const from = addDaysStr(day, -WINDOW_DAYS);
  const sessions = useSessions(from);
  const templates = useTemplates();
  const meals = useMeals(from);
  const weekStart = useWeekStart();
  const [session, setSession] = useState<SessionTarget>(null);
  const [meal, setMeal] = useState<MealTarget>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  useOpenParam(
    async (id) => (await sessionRepo.get(id)) ?? (await mealRepo.get(id)),
    (r) => {
      if ('kcal' in r) setMeal(r);
      else setSession(r);
    },
  );

  // `?new=session|meal|1` (Quick-Add, widget) opens the matching editor; closing drops the parameter.
  const wanted = params.get('new');
  const sessionTarget: SessionTarget =
    session ?? (wanted === 'session' || (wanted && wanted !== 'meal') ? 'new' : null);
  const mealTarget: MealTarget = meal ?? (wanted === 'meal' && prefs.nutrition ? 'new' : null);
  const close = () => {
    setSession(null);
    setMeal(null);
    if (wanted) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'training') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  const week = weekSummary(sessions ?? [], weekOf(day, weekStart));
  const todayKcal = daySum(meals ?? [], day);
  // Only what already happened; a session planned for later is no „last time“.
  const last = latestSession((sessions ?? []).filter((s) => s.date <= day));

  // „Wie letztes Mal“ only while today has no session yet: a second tap would only log a copy.
  const canRepeat = !!last && !(sessions ?? []).some((s) => s.date === day && isLogged(s));
  const plans = (sessions ?? [])
    .filter((s) => !isLogged(s))
    .sort((a, b) => a.date.localeCompare(b.date));
  const planned = plans.filter((s) => isAhead(s, day));
  // Plans whose day has passed: folded away under „Wartet noch“, never a list of misses.
  const waiting = plans.filter((s) => !isAhead(s, day));
  const logged = (sessions ?? []).filter(isLogged);

  /** A planned session is done: it counts from now on, on today when it was planned for later. */
  async function markDone(s: Stored<Session>) {
    const done = t.fitness.planned.logged(sessionTitle(s));
    await undoableWithToast(done, done, () => sessionRepo.update(s.id, doneToday(day)));
  }

  const sessionRow = (s: Stored<Session>) => (
    <ItemRow
      key={s.id}
      title={sessionTitle(s)}
      meta={[
        s.planned ? relativeDayLabel(s.date, day) + (s.time ? ` · ${s.time}` : '') : '',
        s.exercises.length ? t.fitness.list.exercises(s.exercises.length) : '',
        sessionMinutes(s) ? formatMinutes(sessionMinutes(s), { compact: true }) : '',
        ...s.exercises
          .slice(0, 2)
          .map((e) => [e.name, exerciseDetail(e)].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' · ')}
      onOpen={() => setSession(s)}
      end={
        s.planned ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={t.fitness.planned.doneFor(sessionTitle(s))}
            onClick={() => void markDone(s)}
          >
            {t.fitness.planned.done}
          </Button>
        ) : undefined
      }
    />
  );
  async function repeatLast() {
    if (!last) return;
    const done = t.fitness.repeated(sessionTitle(last));
    await undoableWithToast(done, done, () => sessionRepo.create(repeatSession(last, day)));
  }

  const views: readonly View[] = prefs.nutrition
    ? ['training', 'food', 'week']
    : ['training', 'week'];
  return (
    <>
      <PageHeader
        title={t.fitness.meta.name}
        views={
          <Segmented
            label={t.fitness.tabs.label}
            value={view}
            options={views.map((v) => ({ value: v, label: t.fitness.tabs[v] }))}
            onChange={setView}
          />
        }
      >
        {view !== 'food' ? (
          <Button variant="primary" onClick={() => setSession('new')}>
            <Icon name="plus" size={18} />
            {t.fitness.addSession}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setMeal('new')}>
            <Icon name="plus" size={18} />
            {t.fitness.addMeal}
          </Button>
        )}
      </PageHeader>
      {sessions && meals && view !== 'week' ? (
        <HeroSlot area="figure">
          {view !== 'food' ? (
            <HeroFigure
              label={t.fitness.figure.week}
              value={String(week.count)}
              unit={t.fitness.figure.sessions(week.count)}
              detail={week.minutes ? formatMinutes(week.minutes, { compact: true }) : undefined}
              testId="fitness-week"
            />
          ) : (
            <HeroFigure
              label={t.fitness.figure.today}
              value={kcalText(todayKcal)}
              unit="kcal"
              detail={prefs.kcalGoal ? kcalLine(todayKcal, prefs.kcalGoal) : undefined}
              testId="fitness-kcal"
            />
          )}
        </HeroSlot>
      ) : null}

      {view === 'week' ? (
        <WeekView
          day={day}
          weekStart={weekStart}
          sessions={sessions ?? []}
          meals={meals ?? []}
          nutrition={prefs.nutrition}
          loadedFrom={from}
        />
      ) : view === 'training' ? (
        <>
          {canRepeat && last ? (
            <div className={styles.toolbar}>
              <Button variant="secondary" onClick={() => void repeatLast()}>
                <Icon name="repeat" size={18} />
                {t.fitness.repeat(sessionTitle(last))}
              </Button>
            </div>
          ) : null}
          {sessions && sessions.length === 0 ? (
            <EmptyState title={t.fitness.empty.training} testId="fitness-empty">
              <p>{t.fitness.empty.trainingHint}</p>
            </EmptyState>
          ) : null}
          {sessions && sessions.length > 0 ? (
            <GroupedList
              listId="fitness-sessions"
              label={t.fitness.list.training}
              groups={[
                ...(planned.length
                  ? [
                      {
                        id: 'planned',
                        label: t.fitness.planned.group,
                        count: planned.length,
                        children: <ItemList>{planned.map(sessionRow)}</ItemList>,
                      },
                    ]
                  : []),
                ...(waiting.length
                  ? [
                      {
                        id: 'waiting',
                        label: t.fitness.planned.waiting,
                        count: waiting.length,
                        defaultClosed: true,
                        children: <ItemList>{waiting.map(sessionRow)}</ItemList>,
                      },
                    ]
                  : []),
                ...byDay(logged).map(([date, items]) => ({
                  id: date,
                  label: relativeDayLabel(date, day),
                  count: items.length,
                  children: <ItemList>{items.map(sessionRow)}</ItemList>,
                })),
              ]}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Button variant="secondary" onClick={() => setGoalOpen(true)}>
              <Icon name="target" size={18} />
              {t.fitness.goal.open}
            </Button>
          </div>
          {meals && meals.length === 0 ? (
            <EmptyState title={t.fitness.empty.food} testId="fitness-food-empty">
              <p>{t.fitness.empty.foodHint}</p>
            </EmptyState>
          ) : null}
          {meals && meals.length > 0 ? (
            <GroupedList
              listId="fitness-meals"
              label={t.fitness.list.food}
              groups={byDay(meals).map(([date, items]) => ({
                id: date,
                label: relativeDayLabel(date, day),
                count: items.length,
                detail: t.fitness.list.dayKcal(kcalText(daySum(items, date))),
                children: (
                  <ItemList>
                    {items.map((m) => (
                      <ItemRow
                        key={m.id}
                        title={m.text}
                        meta={[m.time ?? '', t.fitness.line.kcal(kcalText(m.kcal))]
                          .filter(Boolean)
                          .join(' · ')}
                        onOpen={() => setMeal(m)}
                      />
                    ))}
                  </ItemList>
                ),
              }))}
            />
          ) : null}
        </>
      )}

      <SessionEditor
        target={sessionTarget}
        sessions={sessions ?? []}
        templates={templates ?? []}
        onClose={close}
      />
      <MealEditor target={mealTarget} meals={meals ?? []} onClose={close} />
      <GoalDialog open={goalOpen} current={prefs.kcalGoal} onClose={() => setGoalOpen(false)} />
    </>
  );
}
