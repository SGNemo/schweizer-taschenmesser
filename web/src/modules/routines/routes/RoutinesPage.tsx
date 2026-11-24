import { PlanMarkLink, usePlanMarks } from '@/core/entitylinks/PlanMark';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { describeRecurrence } from '@/core/recurrence/describe';
import { relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  Badge,
  Button,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Tabs,
  useOpenParam,
} from '@/ui';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { markDone } from '../actions';
import { RoutineEditor, type RoutineTarget } from '../components/RoutineEditor';
import { RoutineRun } from '../components/RoutineRun';
import {
  doneSteps,
  groupByRoom,
  isDue,
  sortRoutines,
  stepsOf,
  whoseTurn,
  type StoredRoutine,
} from '../logic';
import { routineRepo } from '../repo';
import { isStartId } from '../starts';

type View = 'due' | 'all';

export default function RoutinesPage() {
  const routines = useLiveQuery(() => routineRepo.active().toArray(), []);
  const [view, setView] = useState<View>('due');
  const [target, setTarget] = useState<RoutineTarget>(null);
  const [running, setRunning] = useState<string | null>(null);
  // A link to a routine (search, plan) opens its steps when it has some, else its form.
  useOpenParam(
    (id) => routineRepo.get(id),
    (r) => (stepsOf(r).length > 0 ? setRunning(r.id) : setTarget(r)),
  );
  const [params, setParams] = useSearchParams();
  const day = today();

  // `?new=1` (Quick-Add, the widget's empty state) opens the dialog, `?new=morning` with a start filled in.
  const newParam = params.get('new');
  const openTarget =
    target ??
    (newParam ? { draft: true as const, start: isStartId(newParam) ? newParam : undefined } : null);
  const close = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const sorted = useMemo(() => sortRoutines(routines ?? [], day), [routines, day]);
  const due = sorted.filter((r) => isDue(r, day));
  const rooms = useMemo(
    () => groupByRoom(sorted).flatMap((g) => (g.room ? [g.room] : [])),
    [sorted],
  );
  const none = !!routines && routines.length === 0;
  // „Im Plan · Mi“ (planner hub 2, 10b): one read for every routine (its turns are planned as `<id>:<due>`).
  const marks = usePlanMarks(
    'routines',
    sorted.map((r) => ({ id: r.id })),
  );

  const row = (r: StoredRoutine) => {
    const who = whoseTurn(r);
    const dueNow = isDue(r, day);
    const steps = stepsOf(r).length;
    const ticked = doneSteps(r).size;
    return (
      <ItemRow
        key={r.id}
        title={r.name}
        meta={[
          view === 'due' ? r.room : undefined,
          describeRecurrence(r.repeat),
          r.daypart ? t.routines.dayparts[r.daypart] : undefined,
          steps
            ? ticked
              ? t.routines.run.progress(ticked, steps)
              : t.routines.stepCount(steps)
            : undefined,
          who ? t.routines.turnOf(who) : undefined,
        ]
          .filter(Boolean)
          .join(' · ')}
        onOpen={() => setTarget(r)}
        below={marks?.get(r.id) ? <PlanMarkLink state={marks.get(r.id)} /> : undefined}
        end={
          <>
            {/* "dran" is a calm word on a neutral badge: no red, no count of days. */}
            {dueNow ? (
              <Badge>{t.routines.due}</Badge>
            ) : (
              <span>
                {/* Said for screen readers: the date is the next time, not the last. */}
                <span className="sr-only">{t.routines.fields.dueDate}: </span>
                {relativeDayLabel(r.dueDate, day)}
              </span>
            )}
            {/* A routine with steps is gone through step by step; one without is ticked as a whole. */}
            {steps ? (
              <Button
                size="sm"
                variant={dueNow ? 'secondary' : 'ghost'}
                aria-label={t.routines.run.startFor(r.name)}
                onClick={() => setRunning(r.id)}
              >
                {ticked ? t.routines.run.resume : t.routines.run.start}
              </Button>
            ) : (
              <Button
                size="sm"
                variant={dueNow ? 'secondary' : 'ghost'}
                aria-label={t.routines.doneFor(r.name)}
                onClick={() => void markDone(r)}
              >
                {t.routines.done}
              </Button>
            )}
          </>
        }
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.routines.meta.name}
        // Each view starts with a group heading or a short line at the left: the phone's "⋯" lies beside it.
        besideContent={!none}
        views={
          <Tabs
            label={t.routines.views.label}
            value={view}
            options={[
              { value: 'due' as const, label: t.routines.views.due },
              { value: 'all' as const, label: t.routines.views.all },
            ]}
            onChange={setView}
          />
        }
      >
        {/* While there is no routine, the empty state holds the one filled step. */}
        <PageAction
          short={t.routines.meta.quickAdd}
          variant={none ? 'secondary' : 'primary'}
          onClick={() => setTarget({ draft: true })}
        >
          <Icon name="plus" size={18} />
          {t.routines.add}
        </PageAction>
        <StartDataMenu moduleId="routines" />
      </PageHeader>
      {routines && !none ? (
        <HeroSlot area="figure">
          <HeroFigure
            value={String(due.length)}
            unit={t.routines.due}
            detail={t.routines.figureDetail(routines.length)}
            testId="routines-due"
          />
        </HeroSlot>
      ) : null}

      {none ? (
        <EmptyState
          title={t.routines.empty}
          testId="routines-empty"
          motif={<SignatureMark id="cycle" size={64} />}
        >
          <Button variant="primary" onClick={() => setTarget({ draft: true })}>
            {t.routines.addFirst}
          </Button>
        </EmptyState>
      ) : view === 'due' ? (
        due.length === 0 ? (
          <EmptyState title={t.routines.nothingDue} testId="routines-nothing-due" />
        ) : (
          <GroupedList
            listId="routines-due"
            label={t.routines.views.due}
            groups={[
              {
                id: 'due',
                label: t.routines.dueGroup,
                count: due.length,
                children: <ItemList>{due.map(row)}</ItemList>,
              },
            ]}
          />
        )
      ) : (
        <GroupedList
          listId="routines-rooms"
          label={t.routines.views.all}
          groups={groupByRoom(sorted).map((g) => ({
            id: g.room || 'none',
            label: g.room || t.routines.noRoom,
            count: g.items.length,
            children: <ItemList>{g.items.map(row)}</ItemList>,
          }))}
        />
      )}

      <RoutineEditor target={openTarget} rooms={rooms} onClose={close} />
      <RoutineRun
        id={running}
        onClose={() => setRunning(null)}
        onEdit={(r) => {
          setRunning(null);
          setTarget(r);
        }}
      />
    </>
  );
}
