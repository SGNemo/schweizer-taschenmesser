// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DueNotification } from '@/core/modules/types';
import { buildSchedule } from './push';
import { collectDue } from './collect';
import { db } from '@/core/db/db';
import { getMute, muteUntil, onMuteChange, setMute } from './mute';
import { pickUpcoming } from './nativeSchedule';
import { applyLimit, applyMute, applyPolicy } from './policy';
import { asPayload } from './pushPayload';
import { setNow } from '@/core/time/now';
import { startScheduleTriggers } from './triggers';

const at = (h: number, m = 0, day = 2) => new Date(2026, 9, day, h, m).getTime();
const n = (key: string, when: number, soft = false): DueNotification => ({
  key,
  at: when,
  title: key,
  ...(soft ? { soft } : {}),
});
const mute = { from: at(10), until: at(11) };
const summary = (count: number) => ({ title: `Weitere · ${count}` });

describe('applyMute', () => {
  it('lets explicit reminders arrive, without sound, and keeps those outside the pause as they are', () => {
    const out = applyMute([n('in', at(10, 30)), n('before', at(9, 59)), n('after', at(11))], mute);
    expect(out.find((x) => x.key === 'in')).toMatchObject({ at: at(10, 30), quiet: true });
    expect(out.find((x) => x.key === 'before')?.quiet).toBeUndefined();
    expect(out.find((x) => x.key === 'after')?.quiet).toBeUndefined();
  });

  it('moves automatic extras to the end of the pause and loses nothing', () => {
    const out = applyMute([n('soft', at(10, 15), true), n('explicit', at(10, 15))], mute);
    expect(out.find((x) => x.key === 'soft')).toMatchObject({ at: at(11) });
    expect(out.find((x) => x.key === 'soft')?.quiet).toBeUndefined();
    expect(out).toHaveLength(2);
  });

  it('does nothing without a pause', () => {
    const items = [n('a', at(10, 30))];
    expect(applyMute(items, undefined)).toEqual(items);
  });

  it('also silences the summary of a limited hour', () => {
    const items = [n('a', at(10, 5)), n('b', at(10, 10)), n('c', at(10, 20)), n('d', at(10, 30))];
    expect(applyLimit(items, 2, summary).some((x) => x.key.startsWith('summary'))).toBe(true);
    const out = applyPolicy(items, { maxPerHour: 2, mute }, summary);
    expect(out.every((x) => x.quiet)).toBe(true);
    expect(out.some((x) => x.key.startsWith('summary'))).toBe(true);
  });
});

describe('the pause itself', () => {
  beforeEach(() => localStorage.clear());

  it('starts for a preset, ends by itself and can be ended by hand', () => {
    setMute('1h', at(10));
    expect(getMute(at(10, 30))).toMatchObject({ from: at(10), until: at(11), preset: '1h' });
    expect(getMute(at(11))).toBeUndefined();
    setMute(undefined);
    expect(getMute(at(10, 30))).toBeUndefined();
  });

  it('"bis morgen" ends the next morning at 08:00', () => {
    expect(muteUntil('tomorrow', at(22))).toBe(at(8, 0, 3));
    expect(muteUntil('tomorrow', at(6))).toBe(at(8, 0, 3));
  });

  it('is device-local and survives broken storage content', () => {
    setMute('1h', at(10));
    expect(Object.keys(localStorage)).toEqual(['tm-mute']);
    localStorage.setItem('tm-mute', '{broken');
    expect(getMute(at(10, 30))).toBeUndefined();
    localStorage.setItem('tm-mute', JSON.stringify({ from: 1, until: 2, preset: 'forever' }));
    expect(getMute(at(10, 30))).toBeUndefined();
  });

  it('tells the schedules when it starts or ends', () => {
    const fn = vi.fn();
    const stop = onMuteChange(fn);
    setMute('1h', at(10));
    setMute(undefined);
    stop();
    setMute('1h', at(10));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('makes the schedule triggers run again', () => {
    const run = vi.fn();
    const stop = startScheduleTriggers(run, db);
    run.mockClear();
    setMute('1h', at(10));
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('every channel gets the pause', () => {
  beforeEach(async () => {
    localStorage.clear();
    setNow(undefined);
    await db.table('_settings').clear();
    await db.table('_meta').clear();
  });

  const source = (items: { key: string; at: number; soft?: boolean }[]) =>
    [
      {
        contributions: {
          notifications: async () => ({
            default: async () => items.map((x) => ({ ...x, title: x.key })),
          }),
        },
      },
    ] as never;

  it('collectDue marks explicit reminders quiet and moves extras (used by app, Android and push)', async () => {
    setNow(() => at(10, 5));
    setMute('1h', at(10));
    const out = await collectDue(
      { from: at(9), to: at(13) },
      source([
        { key: 'explicit', at: at(10, 20) },
        { key: 'soft', at: at(10, 20), soft: true },
      ]),
    );
    expect(out.find((x) => x.key === 'explicit')?.quiet).toBe(true);
    expect(out.find((x) => x.key === 'soft')?.at).toBe(at(11));
  });

  it('the Android schedule keeps the quiet flag', () => {
    const items = pickUpcoming([{ ...n('a', at(10, 30)), quiet: true }, n('b', at(12))], at(9));
    expect(items.find((x) => x.key === 'a')?.quiet).toBe(true);
    expect('quiet' in items.find((x) => x.key === 'b')!).toBe(false);
  });

  it('the push upload carries it in the payload, and the service worker reads it', async () => {
    const items = await buildSchedule([{ ...n('a', at(10, 30)), quiet: true }], at(9));
    expect(asPayload(JSON.parse(items[0]!.payload))?.quiet).toBe(true);
    expect(asPayload({ title: 'x' })).not.toHaveProperty('quiet');
    expect(asPayload({ title: 'x', quiet: 'yes' })).not.toHaveProperty('quiet');
  });
});

describe('the in-app scheduler and the browser notification', () => {
  it('passes quiet on to the notification service', async () => {
    const { checkDue } = await import('./scheduler');
    const show = vi.fn(async (_n: unknown) => undefined);
    await checkDue({
      service: { permission: () => 'granted', show },
      loadDue: async () => [{ ...n('a', at(10, 30)), quiet: true }, n('b', at(10, 40))],
      getCursor: async () => at(10),
      setCursor: async () => undefined,
      now: () => at(11),
    });
    expect(show).toHaveBeenCalledTimes(2);
    expect(show.mock.calls[0]![0]).toMatchObject({ tag: 'a', quiet: true });
    expect(show.mock.calls[1]![0]).not.toHaveProperty('quiet');
  });

  it('shows a quiet browser notification with silent: true', async () => {
    const { localNotificationService } = await import('./service');
    const shown: NotificationOptions[] = [];
    vi.stubGlobal('Notification', function (_t: string, o: NotificationOptions) {
      shown.push(o);
    });
    await localNotificationService.show({ title: 'x', tag: 't', quiet: true });
    await localNotificationService.show({ title: 'y', tag: 'u' });
    vi.unstubAllGlobals();
    expect(shown[0]?.silent).toBe(true);
    expect(shown[1]).not.toHaveProperty('silent');
  });
});
