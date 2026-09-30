import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import {
  buildCsv,
  csvCell,
  elapsedMinutes,
  formatClock,
  formatDecimalHours,
  formatMinutes,
  groupByDate,
  minutesOf,
  parseDuration,
  runningEntry,
  totalsByProject,
  weekBounds,
} from '../logic';
import manifest from '../manifest';
import { entryRepo, projectRepo } from '../repo';
import { entrySchema, type Entry } from '../schema';

const entry = (o: Partial<Entry> = {}): Entry =>
  entrySchema.parse({ projectId: 'p1', date: '2026-09-29', minutes: 60, ...o });

beforeEach(async () => {
  await db.table('timetrack_project').clear();
  await db.table('timetrack_entry').clear();
});

describe('timetrack module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });
  it('validates entries', () => {
    expect(entrySchema.safeParse({ projectId: '', date: '2026-09-29', minutes: 5 }).success).toBe(
      false,
    );
    expect(entrySchema.safeParse({ projectId: 'p', date: '29.09.2026', minutes: 5 }).success).toBe(
      false,
    );
    expect(entrySchema.safeParse({ projectId: 'p', date: '2026-09-29', minutes: -1 }).success).toBe(
      false,
    );
    expect(
      entrySchema.safeParse({ projectId: 'p', date: '2026-09-29', minutes: 1441 }).success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({
        projectId: 'p',
        date: '2026-09-29',
        minutes: 0,
        startedAt: 1_700_000_000_000,
      }).success,
    ).toBe(true);
  });
});

describe('parseDuration', () => {
  it.each([
    ['1:30', 90],
    ['01:05', 65],
    ['0:45', 45],
    ['1,5', 90],
    ['1.5', 90],
    ['8', 480],
    ['0,25', 15],
    ['90m', 90],
    ['90 min', 90],
    ['2h', 120],
    ['2h30', 150],
    ['1h 30m', 90],
    ['1 h 5 min', 65],
    ['24:00', 1440],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });
  it.each(['', '  ', 'abc', '0', '0:00', '-1', '25:00', '1:60', '1,555', '25', '1:2', '9999m'])(
    'rejects "%s"',
    (text) => {
      expect(parseDuration(text)).toBeUndefined();
    },
  );
});

describe('formatting and timer maths', () => {
  it('formats durations', () => {
    expect(formatMinutes(90)).toBe('1:30');
    expect(formatMinutes(5)).toBe('0:05');
    expect(formatMinutes(0)).toBe('0:00');
    expect(formatDecimalHours(90)).toBe('1,50');
    expect(formatDecimalHours(20)).toBe('0,33');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00:00');
  });
  it('rounds elapsed time to whole minutes, at least one', () => {
    expect(elapsedMinutes(0, 10_000)).toBe(1);
    expect(elapsedMinutes(0, 89_000)).toBe(1);
    expect(elapsedMinutes(0, 91_000)).toBe(2);
    expect(elapsedMinutes(0, 3_600_000)).toBe(60);
  });
  it('counts a running entry by the elapsed time', () => {
    const running = entry({ minutes: 0, startedAt: 1_000_000 });
    expect(minutesOf(running, 1_000_000 + 30 * 60_000)).toBe(30);
    expect(minutesOf(entry({ minutes: 45 }), 0)).toBe(45);
    expect(runningEntry([entry(), running])).toBe(running);
    expect(runningEntry([entry()])).toBeUndefined();
  });
});

describe('week and totals', () => {
  it('runs Monday to Sunday', () => {
    expect(weekBounds('2026-09-29')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(weekBounds('2026-09-28')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(weekBounds('2026-10-04')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });
  it('sums per project inside the range only, biggest first', () => {
    const list = [
      entry({ projectId: 'a', date: '2026-09-28', minutes: 30 }),
      entry({ projectId: 'b', date: '2026-09-30', minutes: 90 }),
      entry({ projectId: 'a', date: '2026-10-04', minutes: 45 }),
      entry({ projectId: 'a', date: '2026-10-05', minutes: 600 }),
      entry({ projectId: 'b', date: '2026-09-27', minutes: 600 }),
    ];
    expect(totalsByProject(list, '2026-09-28', '2026-10-04', 0)).toEqual([
      { projectId: 'b', minutes: 90 },
      { projectId: 'a', minutes: 75 },
    ]);
  });
  it('groups by day, newest first', () => {
    const list = [
      { ...entry({ date: '2026-09-28' }), createdAt: 1 },
      { ...entry({ date: '2026-09-29' }), createdAt: 2 },
      { ...entry({ date: '2026-09-29', minutes: 5 }), createdAt: 3 },
    ];
    const groups = groupByDate(list);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-29', '2026-09-28']);
    expect(groups[0]!.entries.map((e) => e.createdAt)).toEqual([3, 2]);
  });
});

describe('csv time sheet', () => {
  const labels = {
    date: 'Datum',
    project: 'Projekt',
    duration: 'Dauer (h:mm)',
    decimal: 'Dezimal',
    note: 'Notiz',
    total: 'Summe',
  };
  const projects = new Map([
    ['a', { name: 'Website' }],
    ['b', { name: 'Büro; intern' }],
  ]);
  it('escapes cells and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+49 170')).toBe("'+49 170");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@home')).toBe("'@home");
  });
  it('lists one month, sums it, and skips other months and running timers', () => {
    const csv = buildCsv(
      [
        entry({ projectId: 'b', date: '2026-09-05', minutes: 90, note: 'Sitzung' }),
        entry({ projectId: 'a', date: '2026-09-02', minutes: 30, note: '=1+1' }),
        entry({ projectId: 'a', date: '2026-08-31', minutes: 999 }),
        entry({ projectId: 'a', date: '2026-09-10', minutes: 0, startedAt: 5 }),
      ],
      projects,
      '2026-09',
      labels,
    );
    expect(csv.startsWith('\uFEFFDatum;Projekt;Dauer (h:mm);Dezimal;Notiz\r\n')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '\uFEFFDatum;Projekt;Dauer (h:mm);Dezimal;Notiz',
      "02.09.2026;Website;0:30;0,50;'=1+1",
      '05.09.2026;"Büro; intern";1:30;1,50;Sitzung',
      'Summe;;2:00;2,00;',
      '',
    ]);
  });
});

describe('storage', () => {
  it('keeps projects and entries in their own tables', async () => {
    const p = await projectRepo.create({ name: 'Website', archived: false });
    await entryRepo.create({ projectId: p.id, date: '2026-09-29', minutes: 45 });
    expect(await projectRepo.active().count()).toBe(1);
    expect((await entryRepo.active().toArray())[0]).toMatchObject({ projectId: p.id, minutes: 45 });
  });
});
