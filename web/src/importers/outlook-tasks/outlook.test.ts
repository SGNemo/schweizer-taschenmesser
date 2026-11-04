import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectTaskExport, parseTaskExport } from '@/core/io/taskImport';

const read = (n: string) => readFileSync(new URL(`../__fixtures__/${n}`, import.meta.url), 'utf8');

describe('Outlook / Microsoft To Do tasks CSV', () => {
  it('is detected by its header, not mistaken for Todoist', () => {
    expect(detectTaskExport(read('outlook-tasks-en.csv'))).toBe('outlook');
    expect(detectTaskExport(read('outlook-tasks-de.csv'))).toBe('outlook');
  });

  it('reads the English export (month-first dates, multi-line notes, categories)', () => {
    const r = parseTaskExport(read('outlook-tasks-en.csv'), 'outlook', { listName: 'Outlook' });
    expect(r.skipped).toBe(0); // the blank row is dropped by the CSV reader
    expect(r.tasks).toHaveLength(3);
    const [first, second, third] = r.tasks;
    expect(first).toMatchObject({
      title: 'Steuer, Belege sortieren',
      priority: 3,
      due: '2026-01-31',
      done: false,
    });
    expect(first!.description).toBe('Zeile 1\nZeile 2; mit "Zitat"\n\n#Büro #Privat');
    expect(second).toMatchObject({ title: 'Bericht senden', done: true });
    // "no date" is the year 4501 in Outlook
    expect(third!.due).toBeUndefined();
  });

  it('reads the German export (semicolon, day-first dates, umlaut headers)', () => {
    const r = parseTaskExport(read('outlook-tasks-de.csv'), 'outlook', { listName: 'Outlook' });
    expect(r.tasks.map((x) => [x.title, x.due, x.done, x.priority])).toEqual([
      ['Müll rausbringen', '2026-01-16', false, 3],
      ['Zahnarzt', '2026-02-28', true, 0],
    ]);
  });

  it('survives a broken file', () => {
    expect(detectTaskExport('Subject\n"unterminated')).toBeUndefined();
    expect(parseTaskExport('\u0000\u0001', 'outlook', { listName: 'x' }).tasks).toEqual([]);
  });
});
