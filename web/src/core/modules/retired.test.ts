import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup } from '@/core/backup/backup';
import { db } from '@/core/db/db';
import { habitRepo } from '@/modules/habits/repo';
import { feedRepo } from '@/modules/news/repo';
import { projectRepo } from '@/modules/timetrack/repo';
import { availableManifestsFor, allManifests, visibleManifests } from './registry';

const RETIRED = ['habits', 'news', 'timetrack'];

beforeEach(async () => {
  for (const name of ['habits_habit', 'news_feed', 'timetrack_project'])
    await db.table(name).clear();
});

describe('retired modules (Nachrichten, Habits, Zeiterfassung)', () => {
  it('are retired, stripped and invisible at runtime', () => {
    for (const id of RETIRED) {
      const m = allManifests.find((x) => x.id === id)!;
      expect(m.retired, id).toBe(true);
      expect(m.routes, id).toEqual([]);
      expect(m.widgets, id).toEqual([]);
      expect(
        visibleManifests.map((x) => x.id),
        id,
      ).not.toContain(id);
      for (const kind of ['web', 'desktop', 'android'] as const)
        expect(
          availableManifestsFor(kind).map((x) => x.id),
          id,
        ).not.toContain(id);
    }
  });

  it('keep their collections in the schema, so a backup still contains the data', async () => {
    await habitRepo.create({
      name: 'Wasser trinken',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      archived: false,
    });
    await feedRepo.create({
      title: 'Beispiel',
      url: 'https://example.org/feed.xml',
      category: 'sonstiges',
      active: true,
    });
    await projectRepo.create({ name: 'Website', archived: false });
    const { tables } = await createBackup();
    expect(tables['habits_habit']).toHaveLength(1);
    expect(tables['news_feed']).toHaveLength(1);
    expect(tables['timetrack_project']).toHaveLength(1);
    expect(Object.keys(tables)).toEqual(
      expect.arrayContaining(['habits_check', 'timetrack_entry']),
    );
  });
});
