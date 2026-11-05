import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { saveFocusSession } from '@/core/focus/state';
import { startSession } from '@/core/focus/session';
import { patchFocusSettings } from '@/core/settings/focus';
import { collectDue } from './collect';
import { snoozeNotification } from './snooze';

const at = (h: number, m = 0, day = 2) => new Date(2026, 9, day, h, m).getTime();

beforeEach(async () => {
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});

describe('collectDue', () => {
  it('includes "Später" entries and the end of a focus round', async () => {
    await snoozeNotification({ key: 'k', title: 'Paket' }, '1h', at(10));
    await saveFocusSession(
      startSession({ id: 't', title: 'Formular' }, 25, at(10), '/todos/focus/t'),
    );
    const out = await collectDue({ from: at(9), to: at(12) }, []);
    expect(out.map((n) => [n.title, n.at])).toEqual([
      ['Fokus: Zeit ist um', at(10, 25)],
      ['Paket', at(11)],
    ]);
  });

  const softSource = (items: { key: string; at: number; soft?: boolean }[]) =>
    [
      {
        contributions: {
          notifications: async () => ({
            default: async () => items.map((n) => ({ ...n, title: n.key })),
          }),
        },
      },
    ] as never;

  it('drops "Später" entries of a module that was switched off since; old entries still fire', async () => {
    const calendar = [
      {
        id: 'calendar',
        contributions: {
          notifications: async () => ({
            default: async () => [{ key: 'cal:e1:s0', at: at(10), title: 'Tabletten' }],
          }),
        },
      },
    ] as never;
    // The calendar reminder was answered with "Später: 1 Std"; an entry from before has no source.
    const [shown] = await collectDue({ from: at(9), to: at(10) }, calendar);
    await snoozeNotification(shown!, '1h', at(10));
    await snoozeNotification({ key: 'old', title: 'Alt' }, '1h', at(10, 5));
    const later = { from: at(10, 30), to: at(11, 30) };
    expect((await collectDue(later, calendar)).map((n) => n.title)).toEqual(['Tabletten', 'Alt']);
    expect((await collectDue(later, [])).map((n) => n.title)).toEqual(['Alt']);
    // "Später" again on the snoozed one keeps its source.
    const [again] = await collectDue({ from: at(10, 30), to: at(11) }, calendar);
    await snoozeNotification(again!, '1h', at(11));
    const next = { from: at(11, 30), to: at(12, 30) };
    expect((await collectDue(next, calendar)).map((n) => n.title)).toEqual(['Tabletten']);
    expect(await collectDue(next, [])).toEqual([]);
  });

  it('moves a soft extra out of the quiet hours, but not what the user set explicitly', async () => {
    const m = softSource([
      { key: 'soft', at: at(23), soft: true },
      { key: 'explicit', at: at(23) },
    ]);
    expect((await collectDue({ from: at(22), to: at(23, 59) }, m)).map((n) => n.key)).toEqual([
      'explicit',
    ]);
    const morning = await collectDue({ from: at(6, 0, 3), to: at(8, 0, 3) }, m);
    expect(morning.map((n) => [n.key, n.at])).toEqual([['soft', at(7, 0, 3)]]);
  });

  it('folds a crowded hour into one summary', async () => {
    const m = softSource([1, 2, 3, 4, 5].map((i) => ({ key: `e${i}`, at: at(9, i) })));
    const out = await collectDue({ from: at(8), to: at(10) }, m);
    expect(out.map((n) => n.title)).toEqual(['e1', 'e2', '3 Erinnerungen']);
  });

  it('without quiet hours nothing moves', async () => {
    await patchFocusSettings({ quietHours: false });
    await snoozeNotification({ key: 'k', title: 'Spät' }, '1h', at(22, 30));
    expect((await collectDue({ from: at(22), to: at(23, 59) }, [])).map((n) => n.at)).toEqual([
      at(23, 30),
    ]);
  });
});
