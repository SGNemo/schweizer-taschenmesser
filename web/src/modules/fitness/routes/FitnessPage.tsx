import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMinutes } from '@/core/i18n/format';
import { useWeekStart } from '@/core/settings/core';
import { addDaysStr, nowTime, relativeDayLabel, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import type { Stored } from '@/core/db/types';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Tabs,
  useAdvancedMenuItem,
  useOpenParam,
} from '@/ui';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { GoalDialog } from '../components/GoalDialog';
import { MealEditor, type MealTarget } from '../components/MealEditor';
import { SessionEditor, type SessionTarget } from '../components/SessionEditor';
import { ExercisePicto } from '../components/ExercisePicto';
import { WeekView } from '../components/WeekView';
import { ExercisesView } from '../components/ExercisesView';
import { LiveSession } from '../components/LiveSession';
import { PlanDialog } from '../components/PlanDialog';
import { planDays } from '../plan';
import { loadLive, saveLive, startLive, type LiveState } from '../live';
import { patternOf } from '../catalog';
import {
  builtInExercises,
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
  exerciseSuggestions,
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

type View = 'training' | 'food' | 'week' | 'exercises';
/** How far back the lists and the week view go; older entries stay stored. */
const WINDOW_DAYS = 90;

export default function FitnessPage() {
  const [params, setParams] = useSearchParams();
  const prefs = useFitnessSettings();
  const raw = params.get('view');
  // `undefined` while `?view=food` cannot be decided yet: the stored preferences are still loading.
  const view: View | undefined =
    raw === 'week' || raw === 'exercises'
      ? raw
      : raw !== 'food'
        ? 'training'
        : prefs
          ? prefs.nutrition
            ? 'food'
            : 'training'
          : undefined;
  const day = today();
  const from = addDaysStr(day, -WINDOW_DAYS);
  const sessions = useSessions(from);
  const templates = useTemplates();
  const meals = useMeals(from);
  const weekStart = useWeekStart();
  const [session, setSession] = useState<SessionTarget>(null);
  const [meal, setMeal] = useState<MealTarget>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  // „Einheit starten“: the running session of this device (kept across reloads) and whether it is shown.
  // A session left running on an earlier day is over: its sets are saved, only the local state goes.
  const [live, setLive] = useState<LiveState | undefined>(() => {
    const stored = loadLive();
    if (stored && stored.date < today()) return void saveLive(undefined);
    return stored;
  });
  const [liveOpen, setLiveOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  /** Every change of the running session is kept on this device at once (reload, app switch). */
  const putLive = (next: LiveState | undefined) => {
    saveLive(next);
    setLive(next);
  };
  function start(from?: Pick<Session, 'title' | 'exercises'>, planId?: string) {
    setSession(null);
    // One running session per device: a second start opens the one that runs.
    if (!live) putLive(startLive(from, { date: day, time: nowTime(), now: now() }, planId));
    setLiveOpen(true);
    close();
  }
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
  const mealTarget: MealTarget = meal ?? (wanted === 'meal' && prefs?.nutrition ? 'new' : null);
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
  const todayPlan = sessions && templates ? planDays(templates, sessions, day, day) : [];

  /** A planned session is done: it counts from now on, on today when it was planned for later. */
  async function markDone(s: Stored<Session>) {
    const done = t.fitness.planned.logged(sessionTitle(s));
    await undoableWithToast(done, done, () => sessionRepo.update(s.id, doneToday(day)));
  }

  const advancedItem = useAdvancedMenuItem('fitness');
  // Phone (0b-8 follow-up 15): the row names count and minutes only; the first exercises with sets and weights made
  // the meta two to four lines (rows 77–119 px). They stay in the entry's dialog and in the wide list.
  const narrow = usePageWidthAtLeast(48) === false;
  const sessionRow = (s: Stored<Session>) => (
    <ItemRow
      key={s.id}
      title={sessionTitle(s)}
      meta={[
        s.planned ? relativeDayLabel(s.date, day) + (s.time ? ` · ${s.time}` : '') : '',
        s.exercises.length ? t.fitness.list.exercises(s.exercises.length) : '',
        sessionMinutes(s) ? formatMinutes(sessionMinutes(s), { compact: true }) : '',
        ...s.exercises
          .slice(0, narrow ? 0 : 2)
          .map((e) => [e.name, exerciseDetail(e)].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' · ')}
      onOpen={() => setSession(s)}
      lead={<ExercisePicto pattern={s.exercises[0] ? patternOf(s.exercises[0].name) : 'other'} />}
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

  const noSessions = !!sessions && sessions.length === 0;
  const noMeals = !!meals && meals.length === 0;
  const views: readonly View[] = prefs?.nutrition
    ? ['training', 'exercises', 'food', 'week']
    : ['training', 'exercises', 'week'];
  return (
    <>
      <PageHeader
        title={t.fitness.meta.name}
        // Each view starts with a short row at the left (a group heading, the week switch): the phone's "⋯" menu
        // lies beside it. An empty view keeps the menu in its own row.
        // A full-width first row (the running session's line) keeps the phone's "⋯" in its own row.
        besideContent={
          view === 'week' ||
          view === 'exercises' ||
          (view === 'food'
            ? !noMeals
            : !noSessions && !(live && !liveOpen) && !(!live && todayPlan.length))
        }
        views={
          // The tabs depend on the preferences („Essen“ only with calorie tracking), so they wait for them.
          prefs && view ? (
            <Tabs
              label={t.fitness.tabs.label}
              value={view}
              options={views.map((v) => ({ value: v, label: t.fitness.tabs[v] }))}
              onChange={setView}
            />
          ) : undefined
        }
      >
        {!view ? null : view !== 'food' ? (
          <PageAction
            short={t.nav.plusThings.session}
            variant={view === 'training' && noSessions ? 'secondary' : 'primary'}
            onClick={() => setSession('new')}
          >
            <Icon name="plus" size={18} />
            {t.fitness.addSession}
          </PageAction>
        ) : (
          <PageAction
            short={t.nav.plusThings.meal}
            variant={noMeals ? 'secondary' : 'primary'}
            onClick={() => setMeal('new')}
          >
            <Icon name="plus" size={18} />
            {t.fitness.addMeal}
          </PageAction>
        )}
        {/* ⋯: what is occasional (repeat the last session, the calorie goal), then Importieren and the setup. */}
        <StartDataMenu
          moduleId="fitness"
          items={[
            ...(view === 'training'
              ? [
                  {
                    id: 'start',
                    label: live ? t.fitness.live.resume : t.fitness.live.start,
                    onSelect: () => start(),
                  },
                ]
              : []),
            ...(view === 'training' || view === 'week'
              ? [{ id: 'plan', label: t.fitness.plan.open, onSelect: () => setPlanOpen(true) }]
              : []),
            ...(view === 'training' && canRepeat && last
              ? [
                  {
                    id: 'repeat',
                    label: t.fitness.repeat(sessionTitle(last)),
                    onSelect: () => void repeatLast(),
                  },
                ]
              : []),
            ...(view === 'food'
              ? [{ id: 'goal', label: t.fitness.goal.open, onSelect: () => setGoalOpen(true) }]
              : []),
            advancedItem,
          ]}
        />
      </PageHeader>
      {sessions && meals && view && view !== 'week' ? (
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
              detail={prefs?.kcalGoal ? kcalLine(todayKcal, prefs.kcalGoal) : undefined}
              testId="fitness-kcal"
            />
          )}
        </HeroSlot>
      ) : null}
      {!prefs || !view ? null : view === 'week' ? (
        <WeekView
          day={day}
          weekStart={weekStart}
          sessions={sessions ?? []}
          meals={meals ?? []}
          nutrition={prefs.nutrition}
          loadedFrom={from}
          templates={templates ?? []}
        />
      ) : view === 'exercises' ? (
        <ExercisesView day={day} />
      ) : view === 'training' ? (
        <>
          {live && !liveOpen ? (
            <div className={styles.liveBanner} data-testid="fitness-live-banner">
              <p>{t.fitness.live.banner(live.time)}</p>
              <Button size="sm" variant="secondary" onClick={() => setLiveOpen(true)}>
                {t.fitness.live.resume}
              </Button>
            </div>
          ) : null}
          {/* The plan's day: one quiet row with „Anfangen“, gone once the day has a session. */}
          {!live && todayPlan.length ? (
            <div className={styles.todayPlan} data-testid="fitness-today-plan">
              <ItemList>
                {todayPlan.map(({ template: tpl }) => (
                  <ItemRow
                    key={tpl.id}
                    title={t.fitness.plan.today(tpl.title)}
                    meta={[
                      tpl.exercises.length ? t.fitness.list.exercises(tpl.exercises.length) : '',
                      tpl.durationMin ? formatMinutes(tpl.durationMin, { compact: true }) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    lead={
                      <ExercisePicto
                        pattern={tpl.exercises[0] ? patternOf(tpl.exercises[0].name) : 'other'}
                      />
                    }
                    end={
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={t.fitness.plan.startFor(tpl.title)}
                        onClick={() => start(tpl)}
                      >
                        {t.fitness.plan.start}
                      </Button>
                    }
                  />
                ))}
              </ItemList>
            </div>
          ) : null}
          {noSessions ? (
            <EmptyState
              title={t.fitness.empty.training}
              testId="fitness-empty"
              motif={<SignatureMark id="dumbbell" size={64} />}
            >
              <p>{t.fitness.empty.trainingHint}</p>
              <Button variant="primary" onClick={() => setSession('new')}>
                {t.fitness.empty.trainingAdd}
              </Button>
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
          {noMeals ? (
            <EmptyState
              title={t.fitness.empty.food}
              testId="fitness-food-empty"
              motif={<SignatureMark id="dumbbell" size={64} />}
            >
              <p>{t.fitness.empty.foodHint}</p>
              <Button variant="primary" onClick={() => setMeal('new')}>
                {t.fitness.empty.foodAdd}
              </Button>
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
        // While a session runs, the form offers no second start (its fields would be lost).
        onStart={live ? undefined : start}
      />
      <LiveSession
        state={liveOpen ? live : undefined}
        sessions={sessions ?? []}
        restSec={prefs?.restSec ?? 90}
        own={exerciseSuggestions(sessions ?? [], builtInExercises()).filter(
          (n) => !builtInExercises().includes(n),
        )}
        onChange={putLive}
        onClose={() => setLiveOpen(false)}
        onEnd={() => {
          putLive(undefined);
          setLiveOpen(false);
        }}
      />
      <MealEditor target={mealTarget} meals={meals ?? []} onClose={close} />
      <PlanDialog
        open={planOpen}
        templates={templates ?? []}
        weekStart={weekStart}
        onClose={() => setPlanOpen(false)}
      />
      <GoalDialog
        open={goalOpen}
        current={prefs?.kcalGoal ?? 0}
        onClose={() => setGoalOpen(false)}
      />
    </>
  );
}
