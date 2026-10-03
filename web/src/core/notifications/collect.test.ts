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
    expect(out.map((n) => n.title)).toEqual(['e1', 'e2', 'Weitere Erinnerungen · 3']);
  });

  it('without quiet hours nothing moves', async () => {
    await patchFocusSettings({ quietHours: false });
    await snoozeNotification({ key: 'k', title: 'Spät' }, '1h', at(22, 30));
    expect((await collectDue({ from: at(22), to: at(23, 59) }, [])).map((n) => n.at)).toEqual([
      at(23, 30),
    ]);
  });
});
