import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTodoistCsv, parseTodoistDate } from './todoistCsv';

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
const TODAY = '2026-09-29';

describe('parseTodoistCsv (German export)', () => {
  const { tasks, skipped } = parseTodoistCsv(fixture('todoist-de.csv'), {
    listName: 'Haushalt',
    today: TODAY,
  });
  const by = (title: string) => tasks.find((x) => x.title === title)!;

  it('reads umlauts, quoted commas and every task row', () => {
    expect(tasks.map((x) => x.title)).toEqual([
      'Küche aufräumen',
      'Müll rausbringen',
      'Gelbe Säcke holen',
      'Größe prüfen',
      'Brot, Käse & Äpfel kaufen',
      'Zahnarzt anrufen',
    ]);
    expect(tasks.every((x) => x.list === 'Haushalt' && !x.done)).toBe(true);
  });

  it('counts sections and empty titles as skipped, blank rows not at all', () => {
    expect(skipped).toBe(2);
  });

  it('maps priority 1–4 onto high … none', () => {
    expect(by('Küche aufräumen').priority).toBe(3);
    expect(by('Größe prüfen').priority).toBe(2);
    expect(by('Gelbe Säcke holen').priority).toBe(1);
    expect(by('Müll rausbringen').priority).toBe(0);
  });

  it('joins description and notes, in order', () => {
    expect(by('Küche aufräumen').description).toBe(
      'Schränke und Schubladen\n\nMit dem Spülmittel von letzter Woche',
    );
    expect(by('Müll rausbringen').description).toBeUndefined();
  });

  it('makes one level of subtasks, deeper levels go under the top-level task', () => {
    const parent = by('Müll rausbringen');
    expect(by('Gelbe Säcke holen').parentKey).toBe(parent.key);
    expect(by('Größe prüfen').parentKey).toBe(parent.key);
    expect(parent.parentKey).toBeUndefined();
    expect(by('Brot, Käse & Äpfel kaufen').parentKey).toBeUndefined();
  });

  it('reads dates and keeps everything else as a hint', () => {
    expect(by('Küche aufräumen').due).toBe('2026-10-15');
    expect(by('Brot, Käse & Äpfel kaufen').due).toBe('2026-10-20');
    expect(by('Zahnarzt anrufen').due).toBe('2026-11-03');
    expect(by('Müll rausbringen').due).toBeUndefined();
    expect(by('Müll rausbringen').dateHint).toEqual({ text: 'jeden Montag', recurring: true });
    expect(by('Größe prüfen').dateHint).toEqual({ text: 'morgen', recurring: false });
  });
});

describe('parseTodoistCsv (English export, fewer columns)', () => {
  const { tasks } = parseTodoistCsv(fixture('todoist-en.csv'), { listName: 'Inbox', today: TODAY });
  it('works without description and author columns', () => {
    expect(tasks.map((x) => [x.title, x.due, x.priority])).toEqual([
      ['Renew passport', '2026-10-30', 3],
      ['Water the plants', undefined, 0],
      ['Book table', '2026-03-05', 1],
      ['Plain task', undefined, 0],
    ]);
    expect(tasks[1]!.dateHint?.recurring).toBe(true);
  });
});

describe('parseTodoistCsv edge cases', () => {
  it('returns nothing for other CSV files and for empty input', () => {
    expect(parseTodoistCsv('a,b\n1,2', { listName: 'x' }).tasks).toEqual([]);
    expect(parseTodoistCsv('', { listName: 'x' }).tasks).toEqual([]);
  });
  it('survives CRLF, a BOM and a note before any task', () => {
    const csv = '﻿TYPE,CONTENT,PRIORITY,INDENT\r\nnote,verloren,,\r\ntask,Eins,4,1\r\n';
    const { tasks } = parseTodoistCsv(csv, { listName: 'x' });
    expect(tasks.map((x) => x.title)).toEqual(['Eins']);
  });
});

describe('parseTodoistDate', () => {
  it.each([
    ['2026-10-15', '2026-10-15'],
    ['2026-10-15T09:00:00', '2026-10-15'],
    ['15 Mar 2026', '2026-03-15'],
    ['Mar 15 2026', '2026-03-15'],
    ['15. März 2027', '2027-03-15'],
    ['5 de enero de 2027', '2027-01-05'],
    ['3 juil. 2026', '2026-07-03'],
    ['15 Mar', '2026-03-15'],
    ['15 Mar at 10:30', '2026-03-15'],
    ['15.03.2026', '2026-03-15'],
  ])('%s → %s', (raw, due) => {
    expect(parseTodoistDate(raw, TODAY).due).toBe(due);
  });
  it('does not invent days', () => {
    expect(parseTodoistDate('31 Feb 2026', TODAY).due).toBeUndefined();
    expect(parseTodoistDate('', TODAY)).toEqual({});
  });
  it.each(['every day', 'every! Monday', 'jeden Montag', 'alle 2 Wochen', 'cada lunes'])(
    '%s is a repeat hint',
    (raw) => {
      expect(parseTodoistDate(raw, TODAY)).toEqual({ hint: { text: raw, recurring: true } });
    },
  );
});
