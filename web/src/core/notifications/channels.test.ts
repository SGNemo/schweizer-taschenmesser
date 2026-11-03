import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { channelOn, manifestsForChannel, withChannel } from './channels';
import { collectDue } from './collect';

const at = (h: number, m = 0) => new Date(2026, 9, 2, h, m).getTime();
const mod = (id: string, key: string) =>
  ({
    id,
    contributions: {
      notifications: async () => ({
        default: async () => [{ key, at: at(10), title: key }],
      }),
    },
  }) as never;

describe('notification channels', () => {
  it('is on unless switched off, per module and channel', () => {
    expect(channelOn({}, 'todos', 'center')).toBe(true);
    expect(channelOn({ todos: { alert: false } }, 'todos', 'alert')).toBe(false);
    expect(channelOn({ todos: { alert: false } }, 'todos', 'center')).toBe(true);
    expect(channelOn({ todos: { alert: false } }, 'notes', 'alert')).toBe(true);
  });

  it('only ever stores a switch-off, and forgets a module that is on everywhere again', () => {
    const off = withChannel({}, 'todos', 'alert', false);
    expect(off).toEqual({ todos: { alert: false } });
    expect(withChannel(off, 'todos', 'center', false)).toEqual({
      todos: { alert: false, center: false },
    });
    expect(withChannel(off, 'todos', 'alert', true)).toEqual({});
    expect(withChannel(off, 'notes', 'center', true)).toEqual(off);
  });

  it('without a channel every module counts', () => {
    const list = [mod('a', 'x'), mod('b', 'y')] as never[];
    expect(manifestsForChannel(list, { a: { alert: false } }, undefined)).toHaveLength(2);
    expect(manifestsForChannel(list, { a: { alert: false } }, 'alert')).toHaveLength(1);
  });
});

describe('collectDue per channel', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
    await db.table('_meta').clear();
    await patchFocusSettings({ quietHours: false, maxPerHour: 0 });
  });

  it('leaves a module out of the channel it is switched off for, and only that one', async () => {
    const manifests = [mod('todos', 'task'), mod('calendar', 'event')];
    const range = { from: at(9), to: at(11) };
    const keys = async (c?: 'center' | 'alert') =>
      (await collectDue(range, manifests, c)).map((n) => n.key).sort();
    expect(await keys()).toEqual(['event', 'task']);
    await patchFocusSettings({ notifyChannels: { todos: { alert: false } } });
    expect(await keys('alert')).toEqual(['event']);
    expect(await keys('center')).toEqual(['event', 'task']);
    expect(await keys()).toEqual(['event', 'task']); // no channel: nothing is filtered
  });

  it('does not touch the app\'s own notices ("Später")', async () => {
    const { snoozeNotification } = await import('./snooze');
    await snoozeNotification({ key: 'k', title: 'Paket' }, '1h', at(10));
    await patchFocusSettings({ notifyChannels: { todos: { alert: false, center: false } } });
    const out = await collectDue({ from: at(9), to: at(12) }, [mod('todos', 'task')], 'alert');
    expect(out.map((n) => n.title)).toEqual(['Paket']);
  });
});
