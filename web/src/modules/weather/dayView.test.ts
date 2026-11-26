import { describe, expect, it } from 'vitest';
import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import {
  dayChips,
  dayHints,
  dayRest,
  hourChips,
  isNowMoment,
  liveSentence,
  momentHour,
  momentParams,
  officialOfDay,
  parseMoment,
  wetHours,
  wetSpan,
} from './dayView';
import { swipeStep } from './useStageSwipe';

const tp = tWeatherPage.de;
const tx = tWeather.de;
const TODAY = '2026-11-26';
const WEEK = [
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29',
  '2026-11-30',
  '2026-12-01',
  '2026-12-02',
];

const hour = (date: string, h: number, extra: Partial<HourRow> = {}): HourRow => ({
  time: `${date}T${String(h).padStart(2, '0')}:00`,
  temp: 0,
  group: 'cloudy',
  rain: 0,
  ...extra,
});
const day = (date: string, extra: Partial<DayRow> = {}): DayRow => ({
  date,
  min: -3,
  max: 4,
  group: 'snow',
  code: 73,
  rain: 90,
  ...extra,
});

describe('parseMoment: the address (CONCEPT-DAYS §3)', () => {
  const cases: [
    string,
    string | null,
    string | null,
    { date: string; hour: number | null },
    boolean,
  ][] = [
    ['no parameters = now', null, null, { date: TODAY, hour: null }, true],
    ['another day', '2026-11-28', null, { date: '2026-11-28', hour: null }, true],
    ['another day and an hour', '2026-11-28', '14', { date: '2026-11-28', hour: 14 }, true],
    [
      'one digit hour is written again as two',
      '2026-11-28',
      '9',
      { date: '2026-11-28', hour: 9 },
      false,
    ],
    ['an hour alone means today', null, '15', { date: TODAY, hour: 15 }, false],
    ['today without an hour is now, written away', TODAY, null, { date: TODAY, hour: null }, false],
    [
      'a day outside the week falls back to now',
      '2026-12-03',
      null,
      { date: TODAY, hour: null },
      false,
    ],
    [
      'yesterday (midnight passed) falls back to now',
      '2026-11-25',
      '10',
      { date: TODAY, hour: null },
      false,
    ],
    ['a broken day falls back to now', '28.11.', null, { date: TODAY, hour: null }, false],
    ['a broken hour keeps the day', '2026-11-28', '25', { date: '2026-11-28', hour: null }, false],
    [
      'letters as the hour keep the day',
      '2026-11-28',
      'ab',
      { date: '2026-11-28', hour: null },
      false,
    ],
  ];
  it.each(cases)('%s', (_, d, h, moment, clean) => {
    expect(parseMoment(d, h, WEEK, TODAY)).toEqual({ moment, clean });
  });

  it('only cached days are offered: a day that slid out falls back', () => {
    expect(parseMoment('2026-12-02', null, WEEK.slice(0, 5), TODAY).moment.date).toBe(TODAY);
  });

  it('round trip: the parameters of a moment read back as the same moment', () => {
    for (const m of [
      { date: TODAY, hour: null },
      { date: TODAY, hour: 7 },
      { date: '2026-11-30', hour: null },
      { date: '2026-12-02', hour: 23 },
    ]) {
      const p = momentParams(m, TODAY);
      expect(parseMoment(p.day ?? null, p.hour ?? null, WEEK, TODAY)).toEqual({
        moment: m,
        clean: true,
      });
    }
  });

  it('now has no parameters', () => {
    expect(momentParams({ date: TODAY, hour: null }, TODAY)).toEqual({});
    expect(isNowMoment({ date: TODAY, hour: null }, TODAY)).toBe(true);
    expect(isNowMoment({ date: TODAY, hour: 9 }, TODAY)).toBe(false);
  });
});

describe('momentHour: what the head draws', () => {
  const f: Forecast = {
    temp: 1,
    group: 'cloudy',
    days: [
      day('2026-11-28', { sunrise: '2026-11-28T07:44', sunset: '2026-11-28T16:20' }),
      day('2026-12-02'),
    ],
    hours: Array.from({ length: 24 }, (_, h) => hour('2026-11-28', h, { temp: h === 13 ? 4 : 0 })),
  };
  it.each([
    ['a chosen hour', { date: '2026-11-28', hour: 9 }, '2026-11-28T09:00', true, false],
    [
      'the middle hour of the day',
      { date: '2026-11-28', hour: null },
      '2026-11-28T13:00',
      false,
      false,
    ],
    [
      'a day without hours: the day as one hour at 14:00',
      { date: '2026-12-02', hour: null },
      '2026-12-02T14:00',
      false,
      true,
    ],
  ] as const)('%s', (_, m, time, chosen, fromDay) => {
    const r = momentHour(f, m)!;
    expect(r.row.time).toBe(time);
    expect(r.chosen).toBe(chosen);
    expect(r.fromDay).toBe(fromDay);
  });
  it('a day without a row gives nothing', () => {
    expect(momentHour(f, { date: '2026-12-05', hour: null })).toBeUndefined();
  });
});

describe('the chips and the line of a day (COPY §4)', () => {
  const date = '2026-11-28';
  const mm = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1.2, 1, 1, 0, 0, 0, 0, 0, 0];
  const rainy: Forecast = {
    temp: 1,
    group: 'rain',
    hours: mm.map((v, h) => hour(date, h, { mm: v, cloud: 50 })),
  };
  it.each([
    ['dry', [] as number[], undefined],
    ['rain 14–18', [14, 15, 16, 17], { from: '14', to: '18', mm: 4, snow: false, cm: 0 }],
    ['one hour', [9], { from: '9', to: '10', mm: 1, snow: false, cm: 0 }],
  ])('wetSpan: %s', (_, wet, want) => {
    const hours = Array.from({ length: 24 }, (_, h) =>
      hour(date, h, { mm: wet.includes(h) ? 1 : 0 }),
    );
    expect(wetSpan(hours)).toEqual(want);
  });

  it('wetSpan: mostly snow is named as snow with its centimetres', () => {
    const hours = [9, 10, 11].map((h) => hour(date, h, { mm: 1, snow: 2 }));
    expect(wetSpan(hours)).toMatchObject({ from: '9', to: '12', snow: true, cm: 6 });
  });

  it('wetHours counts snow apart from rain', () => {
    expect(
      wetHours([hour(date, 1, { mm: 1 }), hour(date, 2, { mm: 1, snow: 1 }), hour(date, 3)]),
    ).toEqual({
      rain: 1,
      snow: 1,
    });
  });

  it.each([
    [
      'rain, wind with gusts, UV',
      rainy,
      day(date, { wind: 28, gust: 46, uv: 2, group: 'rain', code: 61 }),
      ['Regen 14–18 Uhr · 4,2 mm', 'Wind bis 28 km/h, Böen 46', 'UV bis 2'],
    ],
    [
      'dry, wind only, no UV',
      { temp: 1, group: 'clear', hours: [hour(date, 12)] } as Forecast,
      day(date, { wind: 10, uv: 0.4, group: 'clear', code: 0, mm: 0 }),
      ['Kein Regen', 'Wind bis 10 km/h'],
    ],
    [
      'no hours cached: the chance and the amount of the day',
      { temp: 1, group: 'rain' } as Forecast,
      day(date, { rain: 70, mm: 6, group: 'rain', code: 61 }),
      ['Regen 70 % (6 mm)'],
    ],
  ])('dayChips: %s', (_, f, d, want) => {
    expect(dayChips(tp, tx, f, d).map((c) => c.text)).toEqual(want);
  });

  it('hourChips: rain in that hour, wind with its direction, UV by day', () => {
    expect(
      hourChips(tp, tx, hour(date, 14, { mm: 0.8, wind: 12, dir: 270, uv: 2 })).map((c) => c.text),
    ).toEqual(['Regen 14–15 Uhr · 0,8 mm', 'Wind 12 km/h W', 'UV 2']);
    expect(hourChips(tp, tx, hour(date, 22, { uv: 2, night: true })).map((c) => c.text)).toEqual([
      'Kein Regen',
    ]);
  });

  it('dayRest: a day leaves out high and low; a chosen hour starts with them', () => {
    const d = day(date, { sunrise: '07:44', sunset: '16:20', sunMin: 24 });
    expect(dayRest(tp, tx, rainy, d, false)).toEqual([
      '4 Stunden mit Regen',
      'Sonnenschein 0,4 h',
      'Bewölkung 50 %',
      'Sonne 07:44–16:20',
    ]);
    expect(dayRest(tp, tx, rainy, d, true)).toEqual([
      '4° / -3°',
      '4 Stunden mit Regen',
      'Sonne 07:44–16:20',
    ]);
  });

  it('dayRest: one hour is singular', () => {
    const f: Forecast = { temp: 1, group: 'rain', hours: [hour(date, 3, { mm: 1 })] };
    expect(dayRest(tp, tx, f, day(date), false)).toEqual(['1 Stunde mit Regen']);
  });
});

describe('hints and official warnings of a day', () => {
  it('dayHints: only that day', () => {
    expect(dayHints(day('2026-11-28', { min: -6 }))).toEqual([
      { kind: 'frost', date: '2026-11-28', value: -6 },
    ]);
    expect(dayHints(undefined)).toEqual([]);
  });
  it('officialOfDay: a warning whose span touches the day', () => {
    const at = (iso: string) => Date.parse(iso);
    const w = (onset: string, expires: string) => ({
      event: 'Glätte',
      level: 2 as const,
      onset: at(onset),
      expires: at(expires),
    });
    const list = [
      w('2026-11-27T20:00:00Z', '2026-11-28T08:00:00Z'),
      w('2026-11-26T10:00:00Z', '2026-11-26T12:00:00Z'),
      w('2026-11-29T00:30:00Z', '2026-11-29T06:00:00Z'),
    ];
    expect(officialOfDay(list, '2026-11-28', 'UTC')).toEqual([list[0]]);
  });
});

describe('the live region (COPY §4)', () => {
  const names = { date: 'Freitag, 27. November', weekday: 'Freitag', time: '14:00' };
  it.each([
    ['a day', { date: '2026-11-27', hour: null }, 'Freitag, 27. November: Regen, 4° / -3°'],
    ['an hour', { date: '2026-11-27', hour: 14 }, 'Freitag 14:00: Regen, 2°'],
  ])('%s', (_, m, want) => {
    expect(
      liveSentence(tp, m, names, 'Regen', day('2026-11-27'), m.hour != null ? 2 : undefined),
    ).toBe(want);
  });
});

describe('swipeStep (CONCEPT-DAYS §3)', () => {
  const W = 412;
  it.each([
    ['left = the next day', 200, -80, 10, 1],
    ['right = the day before', 200, 80, 10, -1],
    ['too short', 200, -50, 0, 0],
    ['too steep (scrolling)', 200, -80, 50, 0],
    ['from the left edge (system back)', 20, 80, 0, 0],
    ['from the right edge', 395, -80, 0, 0],
    ['exactly the limits', 24, -56, 28, 1],
  ] as const)('%s', (_, x0, dx, dy, want) => {
    expect(swipeStep(x0, dx, dy, W)).toBe(want);
  });
});
