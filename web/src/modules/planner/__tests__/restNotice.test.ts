/**
 * „Rest verteilen?“ (use case „Wochenende retten“, package 3): off by default, once a day at 20:00, outside the
 * default quiet hours, soft, no count, never a repeat series; inside custom quiet hours it is left out.
 */
import { describe, expect, it } from 'vitest';
import { applyPolicy, inQuiet, isRepeatKey } from '@/core/notifications/policy';
import { DEFAULT_FOCUS } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import { REST_REMINDER_TIME, restNotices } from '../notifications';

const range = { from: toEpoch('2026-11-14', '00:00'), to: toEpoch('2026-11-16', '23:59') };
const on = { ...DEFAULT_FOCUS, restReminder: true };
const always = () => true;

describe('restNotices', () => {
  it('is off by default', () => {
    expect(DEFAULT_FOCUS.restReminder).toBe(false);
    expect(restNotices(range, DEFAULT_FOCUS, always, () => false)).toEqual([]);
  });

  it('switched on: one per day at 20:00, soft, no count, opens the preview', () => {
    const out = restNotices(range, on, always, () => false);
    expect(out.map((n) => n.key)).toEqual([
      'planner:rest:2026-11-14',
      'planner:rest:2026-11-15',
      'planner:rest:2026-11-16',
    ]);
    expect(out[0]).toMatchObject({
      at: toEpoch('2026-11-14', REST_REMINDER_TIME),
      title: 'Rest verteilen?',
      url: '/planner?rest=1',
      soft: true,
    });
    for (const n of out) {
      expect(isRepeatKey(n.key)).toBe(false);
      expect(`${n.title} ${n.body}`).not.toMatch(/\d/);
    }
  });

  it('only on a day that still holds something', () => {
    const out = restNotices(
      range,
      on,
      (d) => d === '2026-11-15',
      () => false,
    );
    expect(out.map((n) => n.key)).toEqual(['planner:rest:2026-11-15']);
  });

  it('20:00 lies outside the default quiet hours, so the policy keeps it where it is', () => {
    const at = toEpoch('2026-11-14', REST_REMINDER_TIME);
    expect(inQuiet(at, { from: DEFAULT_FOCUS.quietFrom, to: DEFAULT_FOCUS.quietTo })).toBe(false);
    const [n] = restNotices(
      range,
      on,
      (d) => d === '2026-11-14',
      () => false,
    );
    const kept = applyPolicy(
      [n!],
      { quiet: { from: DEFAULT_FOCUS.quietFrom, to: DEFAULT_FOCUS.quietTo }, maxPerHour: 3 },
      () => ({ title: '' }),
    );
    expect(kept.map((x) => x.at)).toEqual([at]);
  });

  it('inside the person’s own quiet hours it is left out, never moved to the morning', () => {
    expect(
      restNotices(range, { ...on, quietFrom: '19:00', quietTo: '07:00' }, always, () => false),
    ).toEqual([]);
    expect(
      restNotices(range, { ...on, quietHours: false, quietFrom: '19:00' }, always, () => false),
    ).toHaveLength(3);
  });

  it('a running „Stumm“ pause leaves it out instead of moving it to the morning', () => {
    expect(restNotices(range, on, always, () => true)).toEqual([]);
  });

  it('stays on this device (no Web Push upload)', () => {
    for (const n of restNotices(range, on, always, () => false)) expect(n.local).toBe(true);
  });
});
