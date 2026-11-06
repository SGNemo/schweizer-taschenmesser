import { describe, expect, it } from 'vitest';
import { catalogManifests } from '@/core/modules/available';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import { assignmentSchema, daySchema, itemSchema } from '../schema';
import { runToast } from '../toast';

describe('planner module', () => {
  it('is finished (packages 1–5): listed in the library without „In Arbeit anzeigen“, still off by default', () => {
    expect(catalogManifests({ showPreview: false }).map((m) => m.id)).toContain('planner');
  });

  it('has a valid manifest without aiSchema, without data API, requiring the ToDos', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.dataApi).toBe(false);
    expect(manifest.requires).toEqual(['todos']);
    expect(manifest.maturity).toBe('stable');
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.identity).toMatchObject({
      hue: 'indigo',
      hue2: 'cobalt',
      head: 'kennzahl',
      widget: 'fortschritt',
      signature: 'weekBars',
    });
    expect(Object.keys(manifest.dataSchema.collections)).toEqual(['day', 'item', 'assignment']);
    expect(manifest.dataSchema.collections.assignment!.indexes).toEqual(['date', 'itemKey']);
  });

  it('validates the rows', () => {
    expect(daySchema.parse({ date: '2026-11-09' })).toEqual({ date: '2026-11-09', blockers: [] });
    expect(daySchema.safeParse({ date: '9.11.' }).success).toBe(false);
    expect(itemSchema.parse({ source: { module: 'todos', id: 'a' } }).order).toBe(0);
    expect(
      assignmentSchema.safeParse({
        itemKey: 'todos:a',
        k: 0,
        of: 1,
        date: '2026-11-09',
        minutes: 30,
        order: 0,
        reason: 'magic',
      }).success,
    ).toBe(false);
  });
});

describe('capacity words', async () => {
  const { capacityLabel, capacityShort } = await import('../components/capacity');
  it('column and sheet say the phrase, the strip one word; off wins, full needs something planned', () => {
    const none = { off: false, usable: 0, planned: 0, free: 0 };
    expect(capacityLabel(none)).toBe('keine freie Zeit');
    expect(capacityShort(none)).toBe('belegt');
    expect(capacityShort({ ...none, off: true })).toBe('frei');
    expect(capacityShort({ off: false, usable: 60, planned: 60, free: 0 })).toBe('voll');
    expect(capacityLabel({ off: false, usable: 60, planned: 30, free: 30 })).toBe(
      '30 Min frei von 1 h',
    );
    expect(capacityShort({ off: false, usable: 60, planned: 0, free: 60 })).toBe('1 h');
  });
});

describe('runToast', () => {
  const titles: Record<string, string> = {
    'todos:f': 'Blogpost',
    'todos:d': 'Keller',
    'todos:x': 'Extrem lange Bezeichnung einer Aufgabe, die niemand so nennen würde',
  };
  const titleOf = (id: string) => titles[id.slice(0, id.lastIndexOf('#'))] ?? id;
  const diff = (moved: { id: string; to: string }[], added: string[] = []) => ({
    diff: {
      added: added.map((to) => ({ id: 'todos:n#0', to, reason: 'new' as const })),
      moved: moved.map((m) => ({ ...m, from: '2026-11-09', reason: 'bumped' as const })),
      removed: [],
      unchanged: 0,
    },
  });

  it('names the planned days and at most two moves plus „n mehr“, under 68 characters', () => {
    const line = runToast(
      diff(
        [
          { id: 'todos:f#0', to: '2026-11-11' },
          { id: 'todos:d#0', to: '2026-11-11' },
          { id: 'todos:d#1', to: '2026-11-12' },
        ],
        ['2026-11-09', '2026-11-10'],
      ),
      titleOf,
      'Eingetragen',
    );
    // Two moves would be 79 characters: one is shown, the rest is counted.
    expect(line).toBe('Eingetragen · Eingeplant: Mo, Di · Blogpost jetzt Mi · 2 mehr');
    expect(line.length).toBeLessThanOrEqual(68);
    expect(runToast(diff([]), titleOf, 'Erledigt')).toBe('Erledigt');
    expect(runToast(undefined, titleOf, 'Erledigt')).toBe('Erledigt');
    const long = runToast(
      diff([
        { id: 'todos:x#0', to: '2026-11-11' },
        { id: 'todos:d#0', to: '2026-11-12' },
      ]),
      titleOf,
      'Erledigt',
    );
    expect(long.length).toBeLessThanOrEqual(68);
    expect(long).toBe('Erledigt · 2 mehr');
  });
});

describe('the field’s deadline phrase', async () => {
  const { extractDuePhrase, nextWeekday } = await import('../dueWords');
  it('reads „bis Do“ and „Frist Fr“, strips them, keeps everything else for the parser', () => {
    expect(extractDuePhrase('Steuer 2 Std bis Do', '2026-11-09')).toEqual({
      text: 'Steuer 2 Std',
      date: '2026-11-12',
      hasDueWord: true,
    });
    expect(extractDuePhrase('Frist Fr: Angebot', '2026-11-09')).toMatchObject({
      date: '2026-11-13',
      hasDueWord: true,
    });
    expect(extractDuePhrase('Steuer bis Donnerstag', '2026-11-11')).toMatchObject({
      text: 'Steuer',
      date: '2026-11-12',
    });
    expect(extractDuePhrase('Blogpost 90min', '2026-11-09')).toEqual({
      text: 'Blogpost 90min',
      hasDueWord: false,
    });
    expect(extractDuePhrase('Miete bis 12.11.', '2026-11-09')).toEqual({
      text: 'Miete bis 12.11.',
      hasDueWord: true,
    });
    // A weekday that is today is today, not next week.
    expect(nextWeekday('2026-11-09', 1)).toBe('2026-11-09');
    expect(nextWeekday('2026-11-09', 7)).toBe('2026-11-15');
  });
});
