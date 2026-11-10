// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addPlace, listPlaces, reorderPlaces } from '../repo';

describe('clock repo', () => {
  beforeEach(async () => {
    await db.table('clock_place').clear();
  });

  it('adds at the end and stores a new order', async () => {
    const a = await addPlace(' Büro Tokio ', 'Asia/Tokyo');
    const b = await addPlace('Mama', 'America/New_York');
    expect(a).toMatchObject({ label: 'Büro Tokio', order: 0 });
    expect(b.order).toBe(1);
    await reorderPlaces([b.id, a.id]);
    expect((await listPlaces()).map((p) => p.label)).toEqual(['Mama', 'Büro Tokio']);
  });

  it('refuses an unknown zone', async () => {
    await expect(addPlace('Nirgendwo', 'Mars/Olympus')).rejects.toThrow();
  });
});
