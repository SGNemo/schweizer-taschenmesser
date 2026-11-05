import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { allManifests } from './registry';
import { collectCalendarItems, compareCalendarItems } from './contributions';
import type { CalendarItem, ModuleManifest } from './types';

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: 'i',
  source: 's',
  kind: 'k',
  title: 't',
  date: '2026-01-01',
  allDay: true,
  ...over,
});

describe('compareCalendarItems', () => {
  it('orders by date, all-day first, time, title', () => {
    const list = [
      item({ id: 'c', date: '2026-01-02' }),
      item({ id: 'timed-late', allDay: false, time: '18:00' }),
      item({ id: 'timed-early', allDay: false, time: '08:00' }),
      item({ id: 'allday-b', title: 'B' }),
      item({ id: 'allday-a', title: 'A' }),
    ].sort(compareCalendarItems);
    expect(list.map((i) => i.id)).toEqual([
      'allday-a',
      'allday-b',
      'timed-early',
      'timed-late',
      'c',
    ]);
  });
});

describe('collectCalendarItems', () => {
  it('merges sources of several modules and survives a failing one', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mk = (
      id: string,
      load: NonNullable<ModuleManifest['contributions']>['calendarItems'],
    ): ModuleManifest =>
      ({ ...allManifests[0]!, id, contributions: { calendarItems: load } }) as ModuleManifest;
    const ok = mk('ok', async () => ({ default: async () => [item({ id: 'x', title: 'ok' })] }));
    const bad = mk('bad', async () => ({
      default: async () => {
        throw new Error('boom');
      },
    }));
    const none = { ...allManifests[0]!, id: 'none', contributions: undefined } as ModuleManifest;
    const items = await collectCalendarItems({ from: '2026-01-01', to: '2026-01-31' }, [
      bad,
      ok,
      none,
    ]);
    expect(items.map((i) => i.title)).toEqual(['ok']);
    err.mockRestore();
  });
});

/** Integration of the real core modules: events, task due dates and reminders share one calendar. */
describe('calendar aggregation across the core modules', () => {
  beforeEach(async () => {
    await Promise.all(['calendar_event', 'todos_task'].map((t) => db.table(t).clear()));
  });

  it('shows events, due tasks and reminders together', async () => {
    const by = (id: string) => allManifests.find((m) => m.id === id)!;
    const table = (id: string, coll: string) =>
      createRepo(`${id}_${coll}`, by(id).dataSchema.collections[coll]!.schema);
    await table('calendar', 'event').create({
      title: 'Arzt',
      allDay: false,
      startDate: '2026-09-29',
      startTime: '10:00',
    });
    await table('todos', 'task').create({
      listId: 'l',
      title: 'Steuer',
      done: false,
      priority: 0,
      order: 0,
      dueDate: '2026-09-29',
    });
    await table('calendar', 'event').create({
      title: 'Miete',
      kind: 'reminder',
      allDay: false,
      startDate: '2026-09-29',
      startTime: '08:00',
      notify: { minutesBefore: 0, enabled: true },
    });

    const items = await collectCalendarItems({ from: '2026-09-29', to: '2026-09-29' }, [
      by('calendar'),
      by('todos'),
    ]);
    expect(items.map((i) => [i.kind, i.title, i.time ?? 'ganztägig'])).toEqual([
      ['task', 'Steuer', 'ganztägig'],
      ['reminder', 'Miete', '08:00'],
      ['event', 'Arzt', '10:00'],
    ]);
  });
});

describe('collectPlannable', () => {
  it('merges the sources of several modules, tags each item with its module and survives a failing one', async () => {
    const { collectPlannable, plannableSource } = await import('./contributions');
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = allManifests.find((m) => m.id === 'example')!;
    const mk = (id: string, list: () => Promise<unknown>): ModuleManifest =>
      ({
        ...base,
        id,
        contributions: {
          ...base.contributions,
          plannable: async () => ({ default: { list: list as never } }),
        },
      }) as ModuleManifest;
    const a = mk('a', async () => [{ id: '1', kind: 'task', title: 'A', to: '/a?open=1' }]);
    const b = mk('b', async () => {
      throw new Error('boom');
    });
    const none = {
      ...base,
      id: 'c',
      contributions: { onboarding: base.contributions!.onboarding },
    };
    const items = await collectPlannable({ today: '2026-11-09', until: '2026-11-15' }, [
      a,
      b,
      none,
    ]);
    expect(items).toEqual([{ id: '1', kind: 'task', title: 'A', to: '/a?open=1', moduleId: 'a' }]);
    expect(err).toHaveBeenCalledTimes(1);
    expect(await plannableSource(none)).toBeUndefined();
    expect(await plannableSource(a)).toBeDefined();
    err.mockRestore();
  });
});
