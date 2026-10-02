import { describe, expect, it } from 'vitest';
import {
  clock,
  extend,
  isOver,
  isRunning,
  MAX_SESSION_MS,
  pause,
  progress,
  resume,
  startSession,
  timeLeft,
} from './session';

const T0 = 1_000_000;
const task = { id: 't1', title: 'Formular ausfüllen' };
const MIN = 60_000;

describe('focus session', () => {
  it('starts running with the chosen length', () => {
    const s = startSession(task, 25, T0);
    expect(isRunning(s)).toBe(true);
    expect(timeLeft(s, T0)).toBe(25 * MIN);
    expect(timeLeft(s, T0 + 5 * MIN)).toBe(20 * MIN);
    expect(progress(s, T0 + 5 * MIN)).toBeCloseTo(0.2);
  });

  it('pausing freezes the time and resuming continues from there', () => {
    const s = pause(startSession(task, 25, T0), T0 + 10 * MIN);
    expect(isRunning(s)).toBe(false);
    expect(timeLeft(s, T0 + 99 * MIN)).toBe(15 * MIN);
    const r = resume(s, T0 + 30 * MIN);
    expect(timeLeft(r, T0 + 30 * MIN)).toBe(15 * MIN);
    expect(timeLeft(r, T0 + 35 * MIN)).toBe(10 * MIN);
  });

  it('is over exactly when the time is up and stays open', () => {
    const s = startSession(task, 5, T0);
    expect(isOver(s, T0 + 5 * MIN - 1)).toBe(false);
    expect(isOver(s, T0 + 5 * MIN)).toBe(true);
    expect(timeLeft(s, T0 + 9 * MIN)).toBe(0);
  });

  it('extending after the end counts from now and re-arms the notice', () => {
    const over = { ...startSession(task, 5, T0), announced: true };
    const e = extend(over, 5, T0 + 8 * MIN);
    expect(timeLeft(e, T0 + 8 * MIN)).toBe(5 * MIN);
    expect(e.announced).toBe(false);
    expect(isOver(e, T0 + 12 * MIN)).toBe(false);
  });

  it('extending a paused session adds to the time left', () => {
    const p = pause(startSession(task, 25, T0), T0 + 10 * MIN);
    expect(timeLeft(extend(p, 5, T0 + 11 * MIN), T0 + 11 * MIN)).toBe(20 * MIN);
  });

  it('never grows beyond the maximum', () => {
    const s = startSession(task, 24 * 60, T0);
    expect(s.durationMs).toBe(MAX_SESSION_MS);
    expect(extend(s, 5, T0)).toBe(s);
  });

  it('formats the countdown with rounding up', () => {
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(1)).toBe('00:01');
    expect(clock(0)).toBe('00:00');
    expect(clock(61_000)).toBe('01:01');
  });
});
