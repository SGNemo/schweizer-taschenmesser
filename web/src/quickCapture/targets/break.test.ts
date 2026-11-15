// @vitest-environment jsdom
/**
 * „Pause …“ through the planner's capture target (use case „Wochenende retten“, F2): a blocker merged into the day
 * row (never replacing it), the typed range or length or 1 h, one undo that takes back only this blocker.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { saveCapture, saveCaptures } from './index';

const states = { todos: true, planner: true };
const day = () => db.table('planner_day').get('2026-11-14');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 9, 0).getTime());
  await db.table('planner_day').clear();
});

describe('break target', () => {
  it('adds a blocker to the typed day, keeps what the day had, and its undo takes only it back', async () => {
    await db.table('planner_day').put({
      id: '2026-11-14',
      date: '2026-11-14',
      availableMin: 360,
      blockers: [{ id: 'w', label: 'Werkstatt', min: 60 }],
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
    const saved = await saveCapture(
      'break',
      { title: 'Zocken', date: '2026-11-14', time: '14:00', endTime: '16:00' },
      { states },
    );
    const row = await day();
    expect(row.availableMin).toBe(360);
    expect(
      row.blockers.map((b: { label: string; min: number; from?: string }) => [
        b.label,
        b.min,
        b.from,
      ]),
    ).toEqual([
      ['Werkstatt', 60, undefined],
      ['Zocken', 120, '14:00'],
    ]);
    await saved.undo();
    expect((await day()).blockers.map((b: { label: string }) => b.label)).toEqual(['Werkstatt']);
  });

  it('without a length it is one hour; with a duration that length; no time unless typed', async () => {
    await saveCapture('break', { title: 'Pause', date: '2026-11-14' }, { states });
    await saveCapture(
      'break',
      { title: 'Freizeit', date: '2026-11-14', estimateMin: 120 },
      { states },
    );
    expect(
      (await day()).blockers.map((b: { label: string; min: number; from?: string }) => [
        b.label,
        b.min,
        b.from,
      ]),
    ).toEqual([
      ['Pause', 60, undefined],
      ['Freizeit', 120, undefined],
    ]);
  });

  it('is not offered while the planner is off', async () => {
    await expect(
      saveCapture('break', { title: 'Pause', date: '2026-11-14' }, { states: { todos: true } }),
    ).rejects.toMatchObject({ code: 'module-off' });
  });

  it('a typed start with a length keeps its time; a captured break is marked as one', async () => {
    await saveCapture(
      'break',
      { title: 'Zocken', date: '2026-11-14', time: '14:00', estimateMin: 120 },
      { states },
    );
    expect((await day()).blockers).toMatchObject([
      { label: 'Zocken', min: 120, from: '14:00', to: '16:00', isBreak: true },
    ]);
  });

  it('two breaks of one day in a batch: one undo takes both back', async () => {
    const saved = await saveCaptures(
      [
        { type: 'break', fields: { title: 'Pause', date: '2026-11-14' } },
        { type: 'break', fields: { title: 'Freizeit', date: '2026-11-14' } },
      ],
      'Pause\nFreizeit',
      { states },
    );
    expect((await day()).blockers).toHaveLength(2);
    await saved.undo();
    expect((await day()).blockers).toEqual([]);
  });
});
