import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  clock,
  extend,
  type FocusSession,
  isOver,
  isRunning,
  pause,
  progress,
  resume,
  timeLeft,
} from '@/core/focus/session';
import { onFocusEnd, useMusicUnreachable } from '@/core/focus/music';
import { tSpotify } from '@/strings.spotify';
import {
  clearFocusSession,
  getFocusSession,
  saveFocusSession,
  useFocusSession,
} from '@/core/focus/state';
import { useNow } from '@/core/focus/useNow';
import { useFocusSettings } from '@/core/settings/focus';
import { now, pad2 } from '@/core/time/now';
import { undoableWithToast } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Checkbox, EmptyState, Skeleton, TextField } from '@/ui';
import { beginFocus, focusMinutesFor, focusPath } from '../focus';
import { proposeSteps } from '../stepTemplates';
import { listRepo, setDone, taskRepo } from '../repo';
import styles from './FocusPage.module.css';

const R = 52;
const CIRC = 2 * Math.PI * R;

/**
 * Focus mode: one task, its steps, a ring timer. The shell hides everything else (`/todos/focus/…`).
 * The round lives device-local (`core/focus`), survives reloads and has a soft end. Esc leaves the
 * screen, the round keeps running (top-bar indicator).
 */
export default function FocusPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const [settings] = useFocusSettings();
  const session = useFocusSession();
  const tick = useNow(1000, Boolean(session));
  const [step, setStep] = useState('');
  /** The proposal is only shown; nothing is stored until the user takes it. */
  const [proposal, setProposal] = useState<readonly string[] | null>(null);
  const musicUnreachable = useMusicUnreachable();
  const music = tSpotify.use();

  const task = useLiveQuery(async () => (await taskRepo.get(taskId)) ?? null, [taskId]);
  const steps = useLiveQuery(
    () =>
      taskRepo
        .active()
        .filter((x) => x.parentId === taskId)
        .sortBy('order'),
    [taskId],
  );
  const list = useLiveQuery(
    async () => (task ? await listRepo.get(task.listId) : undefined),
    [task?.listId],
  );

  // Esc leaves the focus screen; the round keeps running.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) void navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (task === undefined || session === undefined)
    return (
      <div className={styles.page} role="status" aria-label="…">
        <Skeleton width="60%" height="1.5rem" />
        <Skeleton width="40%" />
      </div>
    );
  if (task === null || task.deletedAt !== null)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t.focus.mode.title}</h1>
        <EmptyState title={t.focus.mode.missing}>
          <Link to="/todos">{t.focus.mode.missingAction}</Link>
        </EmptyState>
      </div>
    );

  const mine = session && session.taskId === taskId ? session : null;
  const over = mine ? isOver(mine, tick) : false;

  async function addStep(e: FormEvent) {
    e.preventDefault();
    const value = step.trim();
    if (!value || !task) return;
    await taskRepo.create({
      listId: task.listId,
      parentId: task.id,
      title: value,
      done: false,
      priority: 0,
      order: (steps?.length ?? 0) + 1,
    });
    setStep('');
  }
  const takeSteps = (titles: readonly string[]) =>
    void undoableWithToast(t.focus.mode.steps, t.focus.mode.steps, async () => {
      if (!task) return;
      setProposal(null);
      await taskRepo.createMany(
        titles.map((title, i) => ({
          data: {
            listId: task.listId,
            parentId: task.id,
            title,
            done: false,
            priority: 0,
            order: i + 1,
          },
        })),
      );
    });
  /** Applies a change to the stored round (not to the last render), so quick taps never use stale data. */
  async function change(fn: (s: FocusSession) => FocusSession) {
    const current = await getFocusSession();
    if (current && current.taskId === taskId) await saveFocusSession(fn(current));
  }
  const toggleStep = (id: string, done: boolean) =>
    void taskRepo.update(id, { done, completedAt: done ? now() : undefined });

  async function finish() {
    if (!task) return;
    const full = await taskRepo.get(task.id);
    if (mine) void onFocusEnd(mine.startedAt);
    await clearFocusSession();
    if (full)
      await undoableWithToast(t.focus.mode.finished, t.focus.mode.finished, () =>
        setDone(full, true),
      );
    void navigate('/');
  }
  async function endRound() {
    if (mine) void onFocusEnd(mine.startedAt);
    await clearFocusSession();
    toast(t.focus.mode.ended);
    void navigate('/');
  }

  const header = (
    <div className={styles.top}>
      <Button variant="ghost" onClick={() => void navigate('/')}>
        {t.focus.mode.leave}
      </Button>
      <span className={styles.eyebrow}>{t.focus.mode.eyebrow(list?.name ?? '')}</span>
    </div>
  );

  if (!mine)
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.head}>
          <h1 className={styles.title}>{task.title}</h1>
        </div>
        {session && session.taskId !== taskId ? (
          <>
            <p className={styles.caption}>{t.focus.mode.otherRunning(session.title)}</p>
            <p className={styles.caption}>{t.focus.mode.replaceAsk}</p>
            <div className={styles.actions}>
              <Button
                variant="primary"
                data-autofocus
                onClick={() => void navigate(session.path ?? focusPath(session.taskId))}
              >
                {t.focus.mode.replaceKeep}
              </Button>
              <Button
                onClick={() => void beginFocus(task, settings.focusMinutes, { replace: true })}
              >
                {t.focus.mode.replaceStart}
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => void beginFocus(task, settings.focusMinutes, { replace: true })}
            >
              {t.focus.mode.start(focusMinutesFor(task, settings.focusMinutes))}
            </Button>
          </div>
        )}
        {steps && steps.length > 0 ? (
          <ul className={styles.steps}>
            {steps.map((s) => (
              <li key={s.id} className={styles.step}>
                <Checkbox
                  label={s.title}
                  checked={s.done}
                  onChange={(e) => toggleStep(s.id, e.target.checked)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );

  const left = timeLeft(mine, tick);
  const endAt = mine.endAt ?? tick + mine.leftMs;
  return (
    <div className={styles.page}>
      {header}
      <div className={styles.head}>
        <h1 className={styles.title}>{task.title}</h1>
      </div>

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
          <span>{over ? '00:00' : clock(left)}</span>
          {!isRunning(mine) ? <span className={styles.clockSub}>{t.focus.mode.paused}</span> : null}
        </div>
      </div>

      {over ? (
        <p className={styles.ask} role="status">
          {t.focus.mode.timeUpAsk}
        </p>
      ) : (
        <p className={styles.caption}>
          {t.focus.mode.ofMin(Math.round(mine.durationMs / 60_000))}
          {isRunning(mine)
            ? ` · ${t.focus.mode.endsAt(`${pad2(new Date(endAt).getHours())}:${pad2(new Date(endAt).getMinutes())}`)}`
            : ''}
        </p>
      )}

      {musicUnreachable ? (
        <p className={styles.caption} role="status" data-testid="focus-music-status">
          {music.roundUnreachable}
        </p>
      ) : null}

      <h2 className={styles.stepsTitle}>{t.focus.mode.steps}</h2>
      {steps && steps.length > 0 ? (
        <ul className={styles.steps}>
          {steps.map((s) => (
            <li key={s.id} className={styles.step}>
              <Checkbox
                label={s.title}
                checked={s.done}
                onChange={(e) => toggleStep(s.id, e.target.checked)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <form className={styles.addStep} onSubmit={(e) => void addStep(e)}>
        <div className={styles.grow}>
          <TextField
            label={t.focus.mode.addStep}
            value={step}
            onChange={(e) => setStep(e.target.value)}
          />
        </div>
        <Button type="submit">{t.actions.add}</Button>
      </form>
      {steps && steps.length === 0 && !proposal ? (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setProposal(proposeSteps(task.title).steps)}>
            {t.focus.mode.stepsSuggest}
          </Button>
        </div>
      ) : null}
      {proposal ? (
        <div data-testid="steps-proposal">
          <p className={styles.caption}>{t.focus.mode.stepsPreview}</p>
          <ul className={styles.steps}>
            {proposal.map((s) => (
              <li key={s} className={styles.step}>
                {s}
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => takeSteps(proposal)}>
              {t.focus.mode.stepsTake}
            </Button>
            <Button variant="ghost" onClick={() => setProposal(null)}>
              {t.focus.mode.stepsDrop}
            </Button>
          </div>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button variant="primary" data-autofocus onClick={() => void finish()}>
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
        <Button variant="ghost" onClick={() => void endRound()}>
          {t.focus.mode.endRound}
        </Button>
      </div>
      <p className={styles.hint}>{t.focus.mode.leaveHint}</p>
    </div>
  );
}
