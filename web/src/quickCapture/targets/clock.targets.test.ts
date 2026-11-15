import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { MAX_PLACES } from '@/modules/clock/repo';
import { setNow } from '@/core/time/now';
import { parseCapture } from '../parser';
import { CaptureError, TARGETS, availableTypes, saveCapture } from './index';

const ON = { clock: true };

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 9, 12, 0).getTime());
  await db.table('clock_place').clear();
});

describe('clock capture target („uhr <Stadt>“)', () => {
  it('is offered only while the Uhr module is on', () => {
    expect(availableTypes(ON)).toContain('place');
    expect(availableTypes({ todos: true })).not.toContain('place');
  });

  it('adds the city of a typo-tolerant name and takes it back on undo', async () => {
    const parsed = parseCapture('uhr Tokoi', { now: new Date(), place: () => true });
    expect(parsed.type).toBe('place');
    const saved = await saveCapture('place', parsed.fields, { states: ON });
    expect(await db.table('clock_place').toArray()).toEqual([
      expect.objectContaining({ label: 'Tokio', zone: 'Asia/Tokyo' }),
    ]);
    await saved.undo();
    expect((await db.table('clock_place').toArray())[0]!.deletedAt).not.toBeNull();
  });

  it('refuses an unknown name and anything while the module is off', async () => {
    await expect(
      saveCapture('place', { title: 'Nirgendwohausen' }, { states: ON }),
    ).rejects.toBeInstanceOf(CaptureError);
    await expect(
      saveCapture('place', { title: 'Tokio' }, { states: { clock: false } }),
    ).rejects.toMatchObject({ code: 'module-off' });
  });

  it('stops at the page limit: the 13th place is refused, nothing written, undo of an earlier one untouched', async () => {
    expect(TARGETS.place.maxActive?.count).toBe(MAX_PLACES);
    const first = await saveCapture('place', { title: 'Tokio' }, { states: ON });
    for (let i = 1; i < MAX_PLACES; i++) {
      await saveCapture('place', { title: 'Berlin' }, { states: ON });
    }
    const err = await saveCapture('place', { title: 'Lima' }, { states: ON }).catch((e) => e);
    expect(err).toBeInstanceOf(CaptureError);
    expect(err).toMatchObject({
      code: 'full',
      detail: expect.stringContaining(String(MAX_PLACES)),
    });
    expect(await db.table('clock_place').count()).toBe(MAX_PLACES);
    // The earlier save's undo still works, and makes room again.
    await first.undo();
    await expect(saveCapture('place', { title: 'Lima' }, { states: ON })).resolves.toMatchObject({
      type: 'place',
    });
  });
});
