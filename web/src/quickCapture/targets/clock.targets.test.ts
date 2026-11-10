import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { parseCapture } from '../parser';
import { CaptureError, availableTypes, saveCapture } from './index';

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
});
