/**
 * The running timers live outside the component, so closing the toolbar sheet does not stop them.
 * One interval ticks while anything runs; finishing a countdown announces itself (toast, beep,
 * vibration).
 */
import { create } from 'zustand';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import {
  finished,
  lapStopwatch,
  newCountdown,
  newStopwatch,
  nextPhase,
  pauseCountdown,
  pauseStopwatch,
  POMODORO_MS,
  resetCountdown,
  startCountdown,
  startStopwatch,
  isRunning,
  type Countdown,
  type Phase,
  type Stopwatch,
} from './logic';

export type Mode = 'timer' | 'stopwatch' | 'pomodoro';

interface TimerState {
  mode: Mode;
  timer: Countdown;
  stopwatch: Stopwatch;
  pomodoro: { countdown: Countdown; phase: Phase; round: number };
  /** Bumped by the interval so subscribers re-render while something runs. */
  tick: number;
  setMode(mode: Mode): void;
  setMinutes(minutes: number): void;
  start(): void;
  pause(): void;
  reset(): void;
  lap(): void;
}

let interval: ReturnType<typeof setInterval> | undefined;

function beep(): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // No audio available; the toast and the vibration remain.
  }
}

function announce(message: string): void {
  useUiStore.getState().toast(message);
  beep();
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not supported.
  }
}

export const useTimer = create<TimerState>((set, get) => {
  const anyRunning = () => {
    const s = get();
    return (
      isRunning(s.timer) || s.stopwatch.startedAt !== undefined || isRunning(s.pomodoro.countdown)
    );
  };

  function ensureInterval() {
    if (interval) return;
    interval = setInterval(() => {
      const s = get();
      const t0 = now();
      // Countdown finished?
      if (finished(s.timer, t0)) {
        set({ timer: resetCountdown(s.timer) });
        announce(t.tools.timer.done);
      }
      const p = s.pomodoro;
      if (finished(p.countdown, t0)) {
        const next = nextPhase(p.phase, p.round);
        announce(p.phase === 'work' ? t.tools.timer.workDone : t.tools.timer.restDone);
        set({
          pomodoro: {
            phase: next.phase,
            round: next.round,
            countdown: startCountdown(newCountdown(POMODORO_MS[next.phase]), t0),
          },
        });
      }
      set({ tick: s.tick + 1 });
      if (!anyRunning() && interval) {
        clearInterval(interval);
        interval = undefined;
      }
    }, 250);
  }

  return {
    mode: 'timer',
    timer: newCountdown(5 * 60_000),
    stopwatch: newStopwatch(),
    pomodoro: { countdown: newCountdown(POMODORO_MS.work), phase: 'work', round: 1 },
    tick: 0,
    setMode: (mode) => set({ mode }),
    setMinutes: (minutes) => {
      const ms = Math.max(1, Math.min(minutes, 24 * 60)) * 60_000;
      if (!isRunning(get().timer)) set({ timer: newCountdown(ms) });
    },
    start() {
      const { mode } = get();
      const t0 = now();
      if (mode === 'timer') set({ timer: startCountdown(get().timer, t0) });
      else if (mode === 'stopwatch') set({ stopwatch: startStopwatch(get().stopwatch, t0) });
      else
        set({
          pomodoro: { ...get().pomodoro, countdown: startCountdown(get().pomodoro.countdown, t0) },
        });
      ensureInterval();
    },
    pause() {
      const { mode } = get();
      const t0 = now();
      if (mode === 'timer') set({ timer: pauseCountdown(get().timer, t0) });
      else if (mode === 'stopwatch') set({ stopwatch: pauseStopwatch(get().stopwatch, t0) });
      else
        set({
          pomodoro: { ...get().pomodoro, countdown: pauseCountdown(get().pomodoro.countdown, t0) },
        });
    },
    reset() {
      const { mode } = get();
      if (mode === 'timer') set({ timer: resetCountdown(get().timer) });
      else if (mode === 'stopwatch') set({ stopwatch: newStopwatch() });
      else
        set({ pomodoro: { phase: 'work', round: 1, countdown: newCountdown(POMODORO_MS.work) } });
    },
    lap: () => set({ stopwatch: lapStopwatch(get().stopwatch, now()) }),
  };
});
