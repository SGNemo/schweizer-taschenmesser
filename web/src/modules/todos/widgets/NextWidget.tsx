import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { resetSkipped, skipSuggestion, useSkippedToday } from '@/core/focus/state';
import { useNow } from '@/core/focus/useNow';
import { useCalendarItems } from '@/core/modules/contributions';
import { useFocusSettings } from '@/core/settings/focus';
import { addDaysStr, formatDay, today } from '@/core/time/dates';
import { now, pad2 } from '@/core/time/now';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, RowMenu, useWidgetSize, WidgetBody } from '@/ui';
import { beginFocus, focusMinutesFor, focusPath } from '../focus';
import { nextTier, type PickTask } from '../next';
import { EVENING_HOUR, leftToday, weekReview, type ProgressTask } from '../progress';
import { listRepo, setDone, taskRepo } from '../repo';
import { postponePatch } from '../postpone';
import { buildToday } from '../today';
import styles from './NextWidget.module.css';

/** "in 20 Min", "in 1 Std 5 Min", "Jetzt" for the time to the next appointment. */
const untilText = (minutes: number): string =>
  minutes <= 0
    ? t.focus.today.now
    : minutes < 60
      ? t.focus.today.inMinutes(minutes)
      : t.focus.today.inHours(Math.floor(minutes / 60), minutes % 60);

/**
 * The "Heute" card of the home screen, one place instead of three overlapping lists: the time to
 * the next appointment, "Jetzt dran" (one main button), the day plan and today's appointments.
 * The parts have switches in Settings → Fokus & Aufmerksamkeit; nothing here is red, nothing
 * counts days.
 */
export default function NextWidget() {
  const size = useWidgetSize();
  const navigate = useNavigate();
  const [settings] = useFocusSettings();
  const day = today();
  const tasks = useLiveQuery(() => taskRepo.active().toArray(), []);
  const lists = useLiveQuery(() => listRepo.active().toArray(), []);
  const skipped = useSkippedToday(day);
  const [choosing, setChoosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const tick = useNow(30_000, settings.timeToNext);
  const clock = new Date(tick);
  const items = useCalendarItems({ from: day, to: day });

  const all = useMemo(
    () => (tasks ?? []) as (PickTask & { title: string; listId: string })[],
    [tasks],
  );
  const { next, plan, planRows, until } = buildToday({
    tasks: all,
    items: items ?? [],
    day,
    nowHhmm: `${pad2(clock.getHours())}:${pad2(clock.getMinutes())}`,
    skipped: skipped ?? [],
    planLimit: settings.planLimit,
    showNext: settings.nextOne,
  });
  const openCount = all.filter((x) => !x.done && !x.someday && !x.parentId).length;
  const showPlan = settings.dayPlan && size !== 's';
  const review = useMemo(
    () => (settings.weekReview ? weekReview(all as unknown as ProgressTask[], day) : undefined),
    [settings.weekReview, all, day],
  );
  const evening = settings.eveningWrapUp && new Date(now()).getHours() >= EVENING_HOUR;
  const left = evening ? leftToday(all as unknown as ProgressTask[], day) : [];
  const listName = (id: string) => lists?.find((l) => l.id === id)?.name;

  async function start() {
    if (!next) return;
    // A round that runs for another task is not replaced here: the focus screen asks first.
    await beginFocus(next, settings.focusMinutes);
    void navigate(focusPath(next.id));
  }
  // Out of today: moved to tomorrow and not suggested again today (a date within three days would bring it back).
  const later = async () => {
    if (!next) return;
    await undoableWithToast(t.focus.next.laterDone, t.focus.next.laterDone, () =>
      taskRepo.update(next.id, postponePatch(next, day)),
    );
    await skipSuggestion(next.id, day);
  };
  const wrapUp = () =>
    undoableWithToast(t.focus.progress.wrapDone, t.focus.progress.wrapDone, async () => {
      for (const x of left) await taskRepo.update(x.id, { plannedFor: addDaysStr(day, 1) });
    });
  const toggle = (id: string, done: boolean) => {
    const task = all.find((x) => x.id === id);
    if (!task) return;
    const message = done ? t.todos.markedDone : t.todos.markedOpen;
    void undoableWithToast(message, message, async () => {
      const full = await taskRepo.get(id);
      if (full) await setDone(full, done);
    });
  };

  if (!settings.nextOne && !settings.dayPlan)
    return (
      <WidgetBody loading={false} isEmpty={false}>
        <p className={styles.hint}>{t.focus.next.off}</p>
        <Link to="/settings/darstellung#focus">{t.focus.next.offAction}</Link>
      </WidgetBody>
    );

  return (
    <WidgetBody
      loading={!tasks}
      isEmpty={all.length === 0}
      empty={t.focus.next.empty}
      emptyAction={{ label: t.focus.next.emptyAction, to: '/todos?new=1' }}
    >
      {settings.timeToNext && until ? (
        <p className={styles.until} data-testid="today-until">
          <strong>{untilText(until.minutes)}</strong>
          {` · ${until.item.time} ${until.item.title}`}
        </p>
      ) : null}

      {settings.nextOne ? (
        next ? (
          <div className={styles.card} data-testid="next-card">
            <span className={styles.title}>{next.title}</span>
            <span className={styles.meta}>
              {[
                listName(next.listId),
                next.estimateMin ? t.focus.next.about(next.estimateMin) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => void start()} data-focus-start>
                {t.focus.next.startMin(focusMinutesFor(next, settings.focusMinutes))}
              </Button>
              <Button variant="ghost" onClick={() => void later()}>
                {t.focus.next.later}
              </Button>
              <RowMenu
                label={t.focus.next.menu}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                items={[
                  {
                    id: 'other',
                    label: t.focus.next.other,
                    onSelect: () => void skipSuggestion(next.id, day),
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <span className={styles.title}>
              {openCount === 0 ? t.focus.next.allDone : t.focus.next.nothingMore}
            </span>
            {openCount > 0 ? (
              <div className={styles.actions}>
                <Link to="/todos">{t.todos.title}</Link>
                {(skipped?.length ?? 0) > 0 ? (
                  <Button variant="ghost" onClick={() => void resetSkipped()}>
                    {t.focus.next.resetSkipped}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {showPlan ? (
        <div className={styles.plan} data-testid="day-plan">
          {planRows.length > 0 ? (
            <ul className={styles.rows}>
              {planRows.map((p) => {
                const full = all.find((x) => x.id === p.id)!;
                return (
                  <li key={p.id} className={styles.row}>
                    <Checkbox
                      label={full.title}
                      checked={false}
                      onChange={() => toggle(p.id, true)}
                    />
                    {p.estimateMin ? (
                      <span className={styles.est}>{t.todos.estimateMin(p.estimateMin)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {plan.hidden > 0 ? <p className={styles.hint}>{t.focus.plan.more(plan.hidden)}</p> : null}
          <p className={styles.hint}>
            {plan.free > 0 ? (
              <>
                {t.focus.plan.free(plan.free)}{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setChoosing(true)}
                >
                  {t.focus.plan.choose}
                </button>
              </>
            ) : (
              t.focus.plan.full(settings.planLimit)
            )}
          </p>
          {plan.doneToday > 0 ? (
            <p className={styles.done}>{t.focus.plan.doneToday(plan.doneToday)}</p>
          ) : null}
        </div>
      ) : null}

      {evening && size !== 's' ? (
        <div className={styles.plan} data-testid="wrap-up">
          <span className={styles.planTitle}>{t.focus.progress.wrapTitle}</span>
          {left.length > 0 ? (
            <>
              <p className={styles.hint}>{t.focus.progress.wrapLeft(left.length)}</p>
              <div className={styles.actions}>
                <Button onClick={() => void wrapUp()}>{t.focus.progress.wrapAction}</Button>
              </div>
            </>
          ) : (
            <p className={styles.hint}>{t.focus.progress.wrapClear}</p>
          )}
        </div>
      ) : null}

      {review && size !== 's' ? (
        <div className={styles.plan} data-testid="week-review">
          <div className={styles.planHead}>
            <span className={styles.planTitle}>{t.focus.progress.weekTitle}</span>
            {review.doneThisWeek > 0 ? (
              <span className={styles.est}>{t.focus.progress.weekDone(review.doneThisWeek)}</span>
            ) : null}
          </div>
          <p className={styles.hint}>
            {review.tone === 'more'
              ? t.focus.progress.weekMore(review.doneThisWeek - review.donePrevWeek)
              : review.tone === 'same'
                ? t.focus.progress.weekSame
                : review.tone === 'less'
                  ? t.focus.progress.weekLess
                  : t.focus.progress.weekNone}
            {review.bestDay
              ? ` ${t.focus.progress.weekBest(formatDay(review.bestDay.date, 'EEEE'), review.bestDay.count)}`
              : ''}
          </p>
        </div>
      ) : null}

      <Dialog open={choosing} onClose={() => setChoosing(false)} title={t.focus.plan.chooseTitle}>
        {(() => {
          const options = all
            .filter(
              (x) => !x.done && !x.someday && !x.parentId && !(x.plannedFor && x.plannedFor <= day),
            )
            .sort((a, b) => nextTier(a, day) - nextTier(b, day) || a.order - b.order)
            .slice(0, 12);
          return options.length === 0 ? (
            <p>{t.focus.plan.chooseNone}</p>
          ) : (
            <ul className={styles.rows}>
              {options.map((o) => (
                <li key={o.id} className={styles.row}>
                  <span>{o.title}</span>
                  <Button
                    onClick={() => {
                      void undoableWithToast(t.focus.plan.planned, t.focus.plan.planned, () =>
                        taskRepo.update(o.id, { plannedFor: day }),
                      );
                      if (plan.free <= 1) setChoosing(false);
                    }}
                  >
                    {t.focus.plan.add}
                  </Button>
                </li>
              ))}
            </ul>
          );
        })()}
      </Dialog>
    </WidgetBody>
  );
}
