import { describe, expect, it } from 'vitest';
import { toEpoch } from '@/core/time/dates';
import {
  amountCents,
  elapsedBreak,
  idleMinutes,
  rangeOf,
  report,
  runningSeconds,
  sessionMinutes,
  shiftPeriod,
  stopwatch,
  toCsv,
} from '../logic';

const s = (over: Record<string, unknown> = {}) =>
  ({ date: '2026-11-03', startTime: '09:00', breakMin: 0, ...over }) as never;
const NOW = toEpoch('2026-11-03', '12:00');

describe('session minutes', () => {
  it('is end − start − break', () => {
    expect(sessionMinutes(s({ endTime: '11:30' }), NOW)).toBe(150);
    expect(sessionMinutes(s({ endTime: '11:30', breakMin: 30 }), NOW)).toBe(120);
  });
  it('runs past midnight on the end date', () => {
    expect(
      sessionMinutes(s({ startTime: '22:00', endDate: '2026-11-04', endTime: '01:30' }), NOW),
    ).toBe(210);
  });
  it('counts a running session up to now, and a paused one up to the pause', () => {
    expect(sessionMinutes(s(), NOW)).toBe(180);
    expect(sessionMinutes(s({ pausedDate: '2026-11-03', pausedAt: '10:00' }), NOW)).toBe(60);
  });
  it('never goes below zero', () => {
    expect(sessionMinutes(s({ endTime: '09:10', breakMin: 60 }), NOW)).toBe(0);
  });
  it('knows how long a pause has lasted', () => {
    expect(elapsedBreak({ pausedDate: '2026-11-03', pausedAt: '11:20' }, NOW)).toBe(40);
    expect(elapsedBreak({}, NOW)).toBe(0);
  });
});

describe('stopwatch digits', () => {
  it('formats with or without seconds', () => {
    expect(stopwatch(3909)).toBe('1:05:09');
    expect(stopwatch(3909, false)).toBe('1:05');
    expect(stopwatch(59)).toBe('0:00:59');
  });
  it('counts a running session in seconds minus breaks', () => {
    expect(runningSeconds(s({ breakMin: 10 }), NOW)).toBe(170 * 60);
  });
});

describe('amounts in cents', () => {
  it('rounds per session', () => {
    expect(amountCents(90, 6000)).toBe(9000);
    expect(amountCents(1, 6000)).toBe(100);
    expect(amountCents(10, 4999)).toBe(833); // 833.17 → 833
    expect(amountCents(0, 6000)).toBe(0);
  });
});

describe('periods', () => {
  it('gives week (Monday first) and month ranges and steps through them', () => {
    expect(rangeOf('week', '2026-11-04')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(rangeOf('month', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(shiftPeriod('week', '2026-11-04', -1)).toBe('2026-10-28');
    expect(rangeOf('month', shiftPeriod('month', '2026-11-04', 1)).from).toBe('2026-12-01');
    expect(rangeOf('month', shiftPeriod('month', '2026-11-04', -1)).from).toBe('2026-10-01');
  });
});

describe('report', () => {
  const jobs = new Map([
    ['a', { name: 'Webseite', rateCents: 6000, billable: true, clientId: 'c1' }],
    ['b', { name: 'Intern', rateCents: 5000, billable: false, clientId: undefined }],
  ]);
  const clients = new Map([['c1', { name: 'Beispiel GmbH' }]]);
  const labels = { noJob: 'Ohne Projekt', noClient: 'Ohne Kunde' };
  const sessions = [
    s({ jobId: 'a', endTime: '10:30' }), // 90 min
    s({ jobId: 'a', date: '2026-11-04', startTime: '08:00', endTime: '08:45' }), // 45 min
    s({ jobId: 'b', endTime: '12:00' }), // 180 min, not billable
    s({ endTime: '09:30' }), // 30 min, no job
    s({ jobId: 'a', date: '2026-10-01', endTime: '10:00' }), // outside
  ];
  it('sums time and money per job, client and day', () => {
    const r = report(sessions, jobs, clients, '2026-11-02', '2026-11-08', NOW, labels);
    expect(r.minutes).toBe(345);
    expect(r.billableMinutes).toBe(165); // the non-billable job is time only
    expect(r.cents).toBe(13500); // 135 min × 60 €/h = 135 €
    expect(r.byJob.map((l) => [l.name, l.minutes])).toEqual([
      ['Intern', 180],
      ['Webseite', 135],
      ['Ohne Projekt', 30],
    ]);
    expect(r.byClient.find((l) => l.name === 'Beispiel GmbH')?.cents).toBe(13500);
    expect(r.byDay.get('2026-11-03')).toBe(300);
  });
});

describe('idle and csv', () => {
  it('counts idle minutes', () => {
    expect(idleMinutes(NOW - 25 * 60_000, NOW)).toBe(25);
    expect(idleMinutes(NOW + 5000, NOW)).toBe(0);
  });
  it('writes one row per session with a dot decimal and quoted text', () => {
    const csv = toCsv([
      {
        date: '2026-11-03',
        start: '09:00',
        end: '10:30',
        breakMin: 0,
        minutes: 90,
        project: 'Web, neu',
        client: 'Beispiel "GmbH"',
        billable: true,
        ratePerHour: 6000,
        cents: 9000,
        note: '',
      },
    ]);
    expect(csv.split('\n')[0]).toBe(
      'date,start,end,break_min,minutes,project,client,billable,rate_per_hour,amount,note',
    );
    expect(csv.split('\n')[1]).toBe(
      '2026-11-03,09:00,10:30,0,90,"Web, neu","Beispiel ""GmbH""",yes,60.00,90.00,',
    );
  });
});
