import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { durationMinutes, parseIcs, parseRrule, unfold } from './ics';

// Times with Z / TZID are converted to the device's wall clock; pin it so the expectations are stable.
let previousTz: string | undefined;
beforeAll(() => {
  previousTz = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

const wrap = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('unfold', () => {
  it('joins folded lines', () => {
    expect(unfold('SUMMARY:Ein sehr\r\n  langer Titel\r\nX:1')).toEqual([
      'SUMMARY:Ein sehr langer Titel',
      'X:1',
    ]);
  });
});

describe('parseIcs', () => {
  it('reads a timed event with location, note and escapes', () => {
    const { events, issues } = parseIcs(
      wrap(
        ev(
          'UID:abc-1',
          'SUMMARY:Zahnarzt\\, Dr. Muster',
          'DTSTART:20261012T083000',
          'DTEND:20261012T093000',
          'LOCATION:Musterstraße 1\\; Beispielstadt',
          'DESCRIPTION:Bitte Bonusheft\\nmitbringen',
        ),
      ),
    );
    expect(issues).toEqual([]);
    expect(events).toEqual([
      {
        uid: 'abc-1',
        title: 'Zahnarzt, Dr. Muster',
        allDay: false,
        startDate: '2026-10-12',
        startTime: '08:30',
        endTime: '09:30',
        location: 'Musterstraße 1; Beispielstadt',
        note: 'Bitte Bonusheft\nmitbringen',
      },
    ]);
  });

  it('converts UTC times to the local wall clock (summer and winter time)', () => {
    const { events } = parseIcs(
      wrap(
        ev('SUMMARY:Sommer', 'DTSTART:20260715T100000Z'),
        ev('SUMMARY:Winter', 'DTSTART:20261215T100000Z'),
      ),
    );
    expect(events.map((e) => [e.startDate, e.startTime])).toEqual([
      ['2026-07-15', '12:00'],
      ['2026-12-15', '11:00'],
    ]);
  });

  it('converts TZID times into the local wall clock', () => {
    const { events } = parseIcs(
      wrap(ev('SUMMARY:Call', 'DTSTART;TZID=America/New_York:20261012T090000')),
    );
    expect(events[0]).toMatchObject({ startDate: '2026-10-12', startTime: '15:00' });
  });

  it('keeps floating times and falls back for unknown zones', () => {
    const { events } = parseIcs(
      wrap(
        ev('SUMMARY:Float', 'DTSTART:20261012T140000'),
        ev('SUMMARY:Weird', 'DTSTART;TZID=Mars/Olympus:20261012T140000'),
      ),
    );
    expect(events.map((e) => e.startTime)).toEqual(['14:00', '14:00']);
  });

  it('reads all-day events; DTEND is exclusive', () => {
    const { events } = parseIcs(
      wrap(
        ev('SUMMARY:Ein Tag', 'DTSTART;VALUE=DATE:20261003', 'DTEND;VALUE=DATE:20261004'),
        ev('SUMMARY:Urlaub', 'DTSTART;VALUE=DATE:20261010', 'DTEND;VALUE=DATE:20261017'),
        ev('SUMMARY:Ohne Ende', 'DTSTART;VALUE=DATE:20261020'),
      ),
    );
    expect(events).toEqual([
      { title: 'Ein Tag', allDay: true, startDate: '2026-10-03' },
      { title: 'Urlaub', allDay: true, startDate: '2026-10-10', endDate: '2026-10-16' },
      { title: 'Ohne Ende', allDay: true, startDate: '2026-10-20' },
    ]);
  });

  it('handles multi-day timed events, DURATION and impossible ends', () => {
    const { events } = parseIcs(
      wrap(
        ev('SUMMARY:Reise', 'DTSTART:20261010T180000', 'DTEND:20261012T090000'),
        ev('SUMMARY:Dauer', 'DTSTART:20261011T100000', 'DURATION:PT1H30M'),
        ev('SUMMARY:Rückwärts', 'DTSTART:20261011T100000', 'DTEND:20261011T090000'),
      ),
    );
    expect(events[0]).toMatchObject({ endDate: '2026-10-12', endTime: '09:00' });
    expect(events[1]).toMatchObject({ endTime: '11:30' });
    expect(events[1]!.endDate).toBeUndefined();
    expect(events[2]!.endTime).toBeUndefined();
  });

  it('ignores alarms nested in an event and text outside events', () => {
    const { events } = parseIcs(
      wrap(
        'X-WR-CALNAME:Privat',
        ev(
          'SUMMARY:Mit Alarm',
          'DTSTART:20261012T080000',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:Alarmtext',
          'TRIGGER:-PT15M',
          'END:VALARM',
        ),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.note).toBeUndefined();
  });

  it('maps common recurrence rules', () => {
    const { events, issues } = parseIcs(
      wrap(
        ev(
          'SUMMARY:Wöchentlich',
          'DTSTART:20261012T080000',
          'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10',
        ),
        ev(
          'SUMMARY:Monatlich',
          'DTSTART;VALUE=DATE:20261015',
          'RRULE:FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20271231',
        ),
        ev('SUMMARY:Jährlich', 'DTSTART;VALUE=DATE:20261101', 'RRULE:FREQ=YEARLY;BYMONTH=11'),
      ),
    );
    expect(issues).toEqual([]);
    expect(events[0]!.recurrence).toEqual({
      freq: 'weekly',
      interval: 2,
      byWeekday: [1, 3],
      count: 10,
    });
    expect(events[1]!.recurrence).toEqual({
      freq: 'monthly',
      interval: 1,
      byMonthDay: 15,
      until: '2027-12-31',
    });
    expect(events[2]!.recurrence).toEqual({ freq: 'yearly', interval: 1, monthOfYear: 11 });
  });

  it('imports unsupported rules as single events and reports them', () => {
    const { events, issues } = parseIcs(
      wrap(
        ev('SUMMARY:Erster Montag', 'DTSTART:20261005T080000', 'RRULE:FREQ=MONTHLY;BYDAY=1MO'),
        ev(
          'SUMMARY:Mit Ausnahme',
          'DTSTART:20261012T080000',
          'RRULE:FREQ=DAILY',
          'EXDATE:20261013T080000',
        ),
      ),
    );
    expect(events).toHaveLength(2);
    expect(events[0]!.recurrence).toBeUndefined();
    expect(events[1]!.recurrence).toMatchObject({ freq: 'daily' });
    expect(issues).toEqual([
      { code: 'rrule-unsupported', title: 'Erster Montag' },
      { code: 'exdate', title: 'Mit Ausnahme' },
    ]);
  });

  it('skips cancelled events, series overrides and broken dates', () => {
    const { events, issues } = parseIcs(
      wrap(
        ev('SUMMARY:Abgesagt', 'DTSTART:20261012T080000', 'STATUS:CANCELLED'),
        ev('SUMMARY:Verschoben', 'DTSTART:20261013T080000', 'RECURRENCE-ID:20261012T080000'),
        ev('SUMMARY:Kaputt', 'DTSTART:20261332T080000'),
        ev('SUMMARY:Ohne Start'),
      ),
    );
    expect(events).toEqual([]);
    expect(issues.map((i) => i.code)).toEqual(['cancelled', 'override', 'invalid', 'invalid']);
  });

  it('uses a placeholder for events without a title and tolerates junk', () => {
    expect(parseIcs(wrap(ev('DTSTART;VALUE=DATE:20261012'))).events[0]!.title).toBe('(ohne Titel)');
    expect(parseIcs('not a calendar')).toEqual({ events: [], issues: [] });
    expect(parseIcs('')).toEqual({ events: [], issues: [] });
  });
});

describe('parseRrule / durationMinutes', () => {
  it('rejects rules the model cannot express', () => {
    expect(parseRrule('FREQ=HOURLY')).toBeUndefined();
    expect(parseRrule('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1')).toBeUndefined();
    expect(parseRrule('FREQ=MONTHLY;BYMONTHDAY=1,15')).toBeUndefined();
    expect(parseRrule('FREQ=DAILY;INTERVAL=0')).toBeUndefined();
    expect(parseRrule('nonsense')).toBeUndefined();
  });

  it('reads ISO durations', () => {
    expect(durationMinutes('PT45M')).toBe(45);
    expect(durationMinutes('P1DT2H')).toBe(1560);
    expect(durationMinutes('P1W')).toBe(10080);
    expect(durationMinutes('-PT5M')).toBe(-5);
    expect(durationMinutes('soon')).toBeUndefined();
  });
});
