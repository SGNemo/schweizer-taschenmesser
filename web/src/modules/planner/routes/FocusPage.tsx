import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { onFocusEnd } from '@/core/focus/music';
import {
  clock,
  extend,
  isOver,
  isRunning,
  pause,
  progress,
  resume,
  timeLeft,
  type FocusSession,
} from '@/core/focus/session';
import {
  clearFocusSession,
  getFocusSession,
  saveFocusSession,
  useFocusSession,
} from '@/core/focus/state';
import { useNow } from '@/core/focus/useNow';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, EmptyState, Skeleton } from '@/ui';
import { markDone } from '../actions';
import { beginPlanFocus, planFocusMinutes } from '../focus';
import { useBoard } from '../useBoard';
import styles from './focus.module.css';

const R = 52;
const CIRC = 2 * Math.PI * R;

/**
 * The focus round of one session of the plan (`/planner/focus/:item`): its title, a ring with the
 * session's minutes, Erledigt / Pause / +5 / Runde beenden. The shell hides everything else
 * (`isFocusPath`); Esc leaves the screen, the round keeps running.
 */
export default function PlannerFocusPage() {
  const { item = '' } = useParams();
  const unitId = decodeURIComponent(item);
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const data = useBoard(7);
  const session = useFocusSession();
  const tick = useNow(1000, Boolean(session));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) void navigate('/planner');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (!data || session === undefined)
    return (
      <div className={styles.page} role="status" aria-label="…">
        <Skeleton width="60%" height="1.5rem" />
      </div>
    );

  const row = [...data.board.days.flatMap((d) => d.rows), ...data.board.waiting].find(
    (r) => r.unitId === unitId,
  );
  const mine = session && session.taskId === unitId ? session : null;
  // A round that runs keeps its title even when the plan moved the session meanwhile.
  const title = row
    ? row.of > 1
      ? `${row.title} · ${t.planner.row.part(row.k + 1, row.of)}`
      : row.title
    : mine?.title;
  if (!title)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t.focus.mode.title}</h1>
        <EmptyState title={t.focus.mode.missing}>
          <Link to="/planner">{t.planner.focus.back}</Link>
        </EmptyState>
      </div>
    );

  const unit = { unitId, title, minutes: row?.minutes ?? 25 };
  const header = (
    <div className={styles.top}>
      <Button variant="ghost" onClick={() => void navigate('/planner')}>
        {t.focus.mode.leave}
      </Button>
    </div>
  );

  async function change(fn: (s: FocusSession) => FocusSession) {
    const current = await getFocusSession();
    if (current && current.taskId === unitId) await saveFocusSession(fn(current));
  }
  async function end(done: boolean) {
    if (mine) void onFocusEnd(mine.startedAt);
    await clearFocusSession();
    if (done && row?.entry) await markDone(row.entry, data!.titles);
    else toast(t.focus.mode.ended);
    void navigate('/planner');
  }

  if (!mine)
    return (
      <div className={styles.page}>
        {header}
        <h1 className={styles.title}>{title}</h1>
        {session ? (
          <>
            <p className={styles.caption}>{t.focus.mode.otherRunning(session.title)}</p>
            <p className={styles.caption}>{t.focus.mode.replaceAsk}</p>
          </>
        ) : null}
        <div className={styles.actions}>
          {session ? (
            <Button
              variant="primary"
              data-autofocus
              onClick={() => void navigate(session.path ?? '/planner')}
            >
              {t.focus.mode.replaceKeep}
            </Button>
          ) : null}
          <Button
            variant={session ? 'secondary' : 'primary'}
            data-autofocus={session ? undefined : true}
            onClick={() => void beginPlanFocus(unit, { replace: true })}
          >
            {t.focus.mode.start(planFocusMinutes(unit.minutes))}
          </Button>
        </div>
      </div>
    );

  const over = isOver(mine, tick);
  return (
    <div className={styles.page}>
      {header}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.ringWrap}>
        <svg className={styles.ring} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle className={styles.track} cx="60" cy="60" r={R} />
          <circle
            className={styles.arc}
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress(mine, tick))}
          />
        </svg>
        <div className={styles.clock} role="timer" aria-label={t.focus.mode.title}>
          <span>{over ? '00:00' : clock(timeLeft(mine, tick))}</span>
          {!isRunning(mine) ? <span className={styles.clockSub}>{t.focus.mode.paused}</span> : null}
        </div>
      </div>
      {over ? (
        <p className={styles.ask} role="status">
          {t.focus.mode.timeUpAsk}
        </p>
      ) : (
        <p className={styles.caption}>{t.focus.mode.ofMin(Math.round(mine.durationMs / 60_000))}</p>
      )}
      <div className={styles.actions}>
        <Button variant="primary" data-autofocus onClick={() => void end(true)}>
          {t.focus.mode.done}
        </Button>
        {!over ? (
          <Button
            onClick={() =>
              void change((cur) => (isRunning(cur) ? pause(cur, now()) : resume(cur, now())))
            }
          >
            {isRunning(mine) ? t.focus.mode.pause : t.focus.mode.resume}
          </Button>
        ) : null}
        <Button onClick={() => void change((cur) => extend(cur, 5, now()))}>
          {t.focus.mode.plusFive}
        </Button>
        <Button variant="ghost" onClick={() => void end(false)}>
          {t.focus.mode.endRound}
        </Button>
      </div>
    </div>
  );
}
