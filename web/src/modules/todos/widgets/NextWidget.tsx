import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { resetSkipped, skipSuggestion, useSkippedToday } from '@/core/focus/state';
import { useFocusSettings } from '@/core/settings/focus';
import { addDaysStr, today } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, useWidgetSize, WidgetBody } from '@/ui';
import { beginFocus, focusMinutesFor, focusPath } from '../focus';
import { dayPlan, nextTier, pickNext, type PickTask } from '../next';
import { listRepo, setDone, taskRepo } from '../repo';
import styles from './NextWidget.module.css';

/**
 * "Jetzt dran": one suggested task with Anfangen / Später / Etwas anderes, and the day plan
 * ("Heute", at most N things, what is done today). Each part has a switch in Settings → Fokus &
 * Aufmerksamkeit; nothing here is red, nothing counts days.
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

  const all = useMemo(
    () => (tasks ?? []) as (PickTask & { title: string; listId: string })[],
    [tasks],
  );
  const next = settings.nextOne ? pickNext(all, day, skipped ?? []) : undefined;
  const plan = dayPlan(all, day, settings.planLimit);
  const openCount = all.filter((x) => !x.done && !x.someday && !x.parentId).length;
  const showPlan = settings.dayPlan && size !== 's';
  const listName = (id: string) => lists?.find((l) => l.id === id)?.name;

  async function start() {
    if (!next) return;
    await beginFocus(next, settings.focusMinutes);
    void navigate(focusPath(next.id));
  }
  const later = () =>
    next
      ? undoableWithToast(t.focus.next.laterDone, t.focus.next.laterDone, () =>
          taskRepo.update(next.id, { plannedFor: addDaysStr(day, 1) }),
        )
      : undefined;
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
      {settings.nextOne ? (
        next ? (
          <div className={styles.card} data-testid="next-card">
            <span className={styles.label}>{t.focus.next.title}</span>
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
              <Button variant="primary" onClick={() => void start()}>
                {t.focus.next.startMin(focusMinutesFor(next, settings.focusMinutes))}
              </Button>
              <Button onClick={() => void later()}>{t.focus.next.later}</Button>
              <Button variant="ghost" onClick={() => void skipSuggestion(next.id, day)}>
                {t.focus.next.other}
              </Button>
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
          <div className={styles.planHead}>
            <span className={styles.planTitle}>{t.focus.plan.title}</span>
            {plan.planned.length > 0 ? (
              <span className={styles.est}>
                {t.focus.plan.count(plan.planned.length + plan.hidden)}
              </span>
            ) : null}
          </div>
          {plan.planned.length > 0 ? (
            <ul className={styles.rows}>
              {plan.planned.map((p) => {
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
                      void taskRepo.update(o.id, { plannedFor: day });
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
