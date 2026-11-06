import { describe, expect, it } from 'vitest';
import { parseTodoistCsv, parseTodoistRepeat, todoistMinutes } from './todoistCsv';

describe('Todoist repeats', () => {
  it.each([
    ['every day', { freq: 'daily', interval: 1 }],
    ['daily', { freq: 'daily', interval: 1 }],
    ['täglich', { freq: 'daily', interval: 1 }],
    ['every! 3 days', { freq: 'daily', interval: 3 }],
    ['every other week', { freq: 'weekly', interval: 2 }],
    ['alle 2 Wochen', { freq: 'weekly', interval: 2 }],
    ['every monday at 9am', { freq: 'weekly', interval: 1, byWeekday: [1] }],
    ['jeden Montag um 9 Uhr', { freq: 'weekly', interval: 1, byWeekday: [1] }],
    ['every mon, fri', { freq: 'weekly', interval: 1, byWeekday: [1, 5] }],
    ['every weekday', { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }],
    ['jeden Werktag', { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }],
    ['every 15th', { freq: 'monthly', interval: 1, byMonthDay: 15 }],
    ['jeden 1.', { freq: 'monthly', interval: 1, byMonthDay: 1 }],
    ['every month', { freq: 'monthly', interval: 1 }],
    ['jedes Jahr', { freq: 'yearly', interval: 1 }],
    ['every year starting 1 Jan', { freq: 'yearly', interval: 1 }],
  ])('%s', (text, rule) => expect(parseTodoistRepeat(text)).toEqual(rule));

  it.each(['every last friday', 'every 3rd monday', 'tomorrow', 'every'])(
    '%s stays a hint',
    (text) => expect(parseTodoistRepeat(text)).toBeUndefined(),
  );

  it('reads minutes, ignores days and junk', () => {
    expect(todoistMinutes('45', 'minute')).toBe(45);
    expect(todoistMinutes('900', 'minute')).toBe(480);
    expect(todoistMinutes('2', 'day')).toBeUndefined();
    expect(todoistMinutes('', '')).toBeUndefined();
  });

  it('a CSV row carries the rule and the estimate; unknown repeats stay a hint', () => {
    const csv = [
      'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT',
      'task,Blumen gießen,,4,1,,,every monday,en,Europe/Berlin,15,minute',
      'task,Monatsabschluss,,4,1,,,every last day,en,Europe/Berlin,,',
    ].join('\n');
    const [a, b] = parseTodoistCsv(csv, { listName: 'Haus', today: '2026-11-06' }).tasks;
    expect(a).toMatchObject({ recurrence: { freq: 'weekly', byWeekday: [1] }, estimateMin: 15 });
    expect(a!.dateHint).toBeUndefined();
    expect(b!.recurrence).toBeUndefined();
    expect(b!.dateHint).toEqual({ text: 'every last day', recurring: true });
  });
});
