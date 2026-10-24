import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGoogleTasks } from './googleTasks';
import { detectTaskExport, parseTaskExport } from './taskImport';

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseGoogleTasks (Takeout)', () => {
  const { tasks, skipped } = parseGoogleTasks(fixture('google-tasks.json'), { listName: 'Datei' });
  const by = (title: string) => tasks.find((x) => x.title === title)!;

  it('keeps the list of each task and sorts by position', () => {
    expect(tasks.map((x) => [x.list, x.title])).toEqual([
      ['Einkäufe', 'Wocheneinkauf'],
      ['Einkäufe', 'Käse'],
      ['Einkäufe', 'Milch'],
      ['Arbeit', 'Bericht schreiben'],
      ['Arbeit', 'Ärger mit Übergröße'],
    ]);
  });

  it('skips deleted tasks and empty titles', () => {
    expect(skipped).toBe(2);
  });

  it('reads notes, the due day and the completed state', () => {
    expect(by('Wocheneinkauf').description).toBe('Zettel liegt am Kühlschrank');
    expect(by('Wocheneinkauf').due).toBe('2026-10-12');
    expect(by('Milch').done).toBe(true);
    expect(by('Käse').done).toBe(false);
    expect(by('Käse').description).toBeUndefined();
    expect(by('Ärger mit Übergröße').done).toBe(true);
  });

  it('ignores a broken due value', () => {
    expect(by('Bericht schreiben').due).toBeUndefined();
  });

  it('attaches subtasks (also deeper ones) to the top-level task', () => {
    const top = by('Wocheneinkauf');
    expect(by('Käse').parentKey).toBe(top.key);
    expect(by('Milch').parentKey).toBe(top.key);
    expect(top.parentKey).toBeUndefined();
  });

  it('never invents priorities or repeats', () => {
    expect(tasks.every((x) => x.priority === 0 && !x.dateHint)).toBe(true);
  });
});

describe('parseGoogleTasks shapes', () => {
  it('reads a single list and a bare array of tasks', () => {
    const one = parseGoogleTasks(
      JSON.stringify({ title: 'Privat', items: [{ id: '1', title: 'A', status: 'needsAction' }] }),
      { listName: 'Datei' },
    );
    expect(one.tasks.map((x) => x.list)).toEqual(['Privat']);
    const bare = parseGoogleTasks(
      JSON.stringify([
        { id: '1', title: 'A', status: 'needsAction' },
        { id: '2', title: 'B', parent: '1', status: 'needsAction' },
      ]),
      { listName: 'Datei' },
    );
    expect(bare.tasks.map((x) => [x.list, x.title])).toEqual([
      ['Datei', 'A'],
      ['Datei', 'B'],
    ]);
    expect(bare.tasks[1]!.parentKey).toBe(bare.tasks[0]!.key);
  });
  it('returns nothing for broken JSON', () => {
    expect(parseGoogleTasks('{"items": [', { listName: 'x' })).toEqual({ tasks: [], skipped: 0 });
  });
});

describe('detectTaskExport', () => {
  it('tells the formats apart by content', () => {
    expect(detectTaskExport(fixture('google-tasks.json'))).toBe('google');
    expect(detectTaskExport(fixture('todoist-de.csv'))).toBe('todoist');
    expect(detectTaskExport('﻿  [1]')).toBe('google');
    expect(detectTaskExport('Datum;Betrag\n1;2')).toBeUndefined();
    expect(detectTaskExport('')).toBeUndefined();
  });
  it('parseTaskExport dispatches', () => {
    const text = fixture('todoist-en.csv');
    expect(parseTaskExport(text, 'todoist', { listName: 'x' }).tasks).toHaveLength(4);
  });
});
