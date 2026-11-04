import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Segmented, TextField } from '@/ui';
import { kit, TimerRing } from '../kit';
import styles from '../tools.module.css';
import { useTimer, type Mode } from './engine';
import { clock, elapsed, isRunning, left } from './logic';

const s = t.tools.timer;
const MODES: Mode[] = ['timer', 'stopwatch', 'pomodoro'];

export default function TimerTool() {
  const st = useTimer();
  const t0 = now();
  const running =
    st.mode === 'timer'
      ? isRunning(st.timer)
      : st.mode === 'stopwatch'
        ? st.stopwatch.startedAt !== undefined
        : isRunning(st.pomodoro.countdown);

  const started =
    st.mode === 'timer'
      ? st.timer.leftMs < st.timer.durationMs
      : st.mode === 'stopwatch'
        ? st.stopwatch.elapsedMs > 0
        : st.pomodoro.countdown.leftMs < st.pomodoro.countdown.durationMs;
  const display =
    st.mode === 'timer'
      ? clock(left(st.timer, t0))
      : st.mode === 'stopwatch'
        ? clock(elapsed(st.stopwatch, t0), true)
        : clock(left(st.pomodoro.countdown, t0));

  // The ring shows how much is left (timer, pomodoro) or how far the current minute is (stopwatch).
  const progress =
    st.mode === 'timer'
      ? left(st.timer, t0) / st.timer.durationMs
      : st.mode === 'stopwatch'
        ? (elapsed(st.stopwatch, t0) % 60_000) / 60_000
        : left(st.pomodoro.countdown, t0) / st.pomodoro.countdown.durationMs;

  return (
    <div className={styles.stack}>
      <Segmented
        label={s.mode}
        value={st.mode}
        options={MODES.map((m) => ({ value: m, label: s.modes[m]! }))}
        onChange={st.setMode}
      />
      {st.mode === 'timer' && !running ? (
        <TextField
          label={s.minutes}
          type="number"
          min={1}
          max={1440}
          value={String(Math.round(st.timer.durationMs / 60_000))}
          onChange={(e) => st.setMinutes(Number(e.target.value) || 1)}
        />
      ) : null}
      <TimerRing progress={progress}>
        <p
          className={kit.ringTime}
          role="timer"
          aria-label={s.modes[st.mode]}
          data-testid="timer-display"
        >
          {display}
        </p>
        {st.mode === 'pomodoro' ? (
          <p className={kit.ringSub}>
            {st.pomodoro.phase === 'work' ? s.work : s.rest} · {s.round(st.pomodoro.round)}
          </p>
        ) : null}
      </TimerRing>
      <div className={kit.actions}>
        {running ? (
          <Button variant="primary" onClick={st.pause}>
            {s.pause}
          </Button>
        ) : (
          <Button variant="primary" onClick={st.start}>
            {started ? s.resume : s.start}
          </Button>
        )}
        {st.mode === 'stopwatch' ? (
          <Button onClick={st.lap} disabled={!running}>
            {s.lap}
          </Button>
        ) : null}
        <Button onClick={st.reset}>{s.reset}</Button>
      </div>
      {st.mode === 'stopwatch' && st.stopwatch.laps.length > 0 ? (
        <section aria-label={s.laps}>
          <h3>{s.laps}</h3>
          <ol className={styles.list}>
            {st.stopwatch.laps.map((lap, i) => (
              <li key={i} className={styles.item}>
                <span>{i + 1}.</span>
                <span className={styles.mono}>{clock(lap, true)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
