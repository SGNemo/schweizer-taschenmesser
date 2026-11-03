import { describe, expect, it } from 'vitest';
import { checkGuards, emptyGuard, HOUR_MS, pruneGuard, recordRun } from './guards';
import type { AutomationEvent } from './types';

const rule = { id: 'r1', limitPerHour: 2 };
const ev = (key: string, cause?: AutomationEvent['cause']): AutomationEvent => ({
  type: 't',
  key,
  at: 0,
  data: {},
  ...(cause ? { cause } : {}),
});
const T = 10 * HOUR_MS;

describe('guards', () => {
  it('lets a fresh occurrence through', () => {
    expect(checkGuards(rule, ev('a'), emptyGuard(), T, 0)).toBeUndefined();
  });

  it('refuses a rule that is part of the chain that caused the event (self and A → B → A)', () => {
    expect(
      checkGuards(rule, ev('a', { runId: 'x', ruleIds: ['r1'], depth: 1 }), emptyGuard(), T, 0),
    ).toBe('loop');
    expect(
      checkGuards(
        rule,
        ev('a', { runId: 'x', ruleIds: ['r2', 'r1'], depth: 2 }),
        emptyGuard(),
        T,
        0,
      ),
    ).toBe('loop');
    expect(
      checkGuards(rule, ev('a', { runId: 'x', ruleIds: ['r2'], depth: 1 }), emptyGuard(), T, 0),
    ).toBeUndefined();
  });

  it('refuses chains that are too deep', () => {
    expect(
      checkGuards(rule, ev('a', { runId: 'x', ruleIds: ['r9'], depth: 3 }), emptyGuard(), T, 0),
    ).toBe('depth');
  });

  it('runs once per occurrence', () => {
    const s = recordRun(emptyGuard(), 'r1', 'a', T, true);
    expect(checkGuards(rule, ev('a'), s, T + 1, 0)).toBe('duplicate');
    expect(checkGuards(rule, ev('b'), s, T + 1, 0)).toBeUndefined();
  });

  it('limits per rule and hour, and frees up after the hour', () => {
    let s = emptyGuard();
    s = recordRun(s, 'r1', 'a', T, true);
    s = recordRun(s, 'r1', 'b', T + 1000, true);
    expect(checkGuards(rule, ev('c'), s, T + 2000, 0)).toBe('limit');
    expect(checkGuards(rule, ev('c'), s, T + HOUR_MS + 1500, 0)).toBeUndefined();
  });

  it('limits all rules together', () => {
    let s = emptyGuard();
    s = recordRun(s, 'r2', 'a', T, true);
    s = recordRun(s, 'r3', 'a', T, true);
    expect(checkGuards(rule, ev('x'), s, T + 1, 2)).toBe('global-limit');
    expect(checkGuards(rule, ev('x'), s, T + 1, 0)).toBeUndefined();
  });

  it('prunes old runs and very old occurrences', () => {
    let s = recordRun(emptyGuard(), 'r1', 'a', T, true);
    s = pruneGuard(s, T + 40 * 24 * HOUR_MS);
    expect(s.runs).toEqual({});
    expect(s.seen).toEqual({});
  });
});
