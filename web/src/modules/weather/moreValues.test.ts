import { describe, expect, it } from 'vitest';
import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import { tWeatherPage } from '@/strings.weatherPage';
import { cardRain } from './components/HourCards';
import { hourLineParts } from './components/hourLine';
import { moreGroups } from './moreValues';

const tp = tWeatherPage.get();
const h = (i: number, extra: Partial<HourRow> = {}): HourRow => ({
  time: `2026-11-28T${String(i).padStart(2, '0')}:00`,
  temp: -1,
  feels: -4,
  group: 'snow',
  rain: 80,
  mm: i >= 8 && i < 14 ? 1 : 0,
  wind: 18,
  gust: 40,
  dir: 315,
  hum: 88,
  cloud: 96,
  cloudLow: 88,
  cloudMid: 72,
  cloudHigh: 40,
  hpa: 1009 - i,
  dew: -1,
  vis: 2000,
  snow: i >= 8 && i < 14 ? 1 : 0,
  snowDepth: 0.05,
  freeze: 700,
  cape: 0,
  ...extra,
});
const day: DayRow = {
  date: '2026-11-28',
  min: -3,
  max: 4,
  group: 'snow',
  rain: 80,
  mm: 5.8,
  rainHours: 6,
  gust: 46,
  dir: 315,
  sunrise: '07:44',
  sunset: '16:20',
  sunMin: 24,
};
const forecast: Forecast = {
  temp: -1,
  group: 'snow',
  hours: Array.from({ length: 24 }, (_, i) => h(i)),
  days: [day],
};

describe('Mehr Werte: the groups of COPY §6', () => {
  it('a snowy day has all six groups but the thunder tendency, in order', () => {
    const groups = moreGroups(tp, forecast, day, '2026-11-28T12:00', false);
    expect(groups.map((g) => g.title)).toEqual([
      'Gefühl',
      'Niederschlag',
      'Wind',
      'Himmel',
      'Luftdruck',
    ]);
    const lines = Object.fromEntries(
      groups.flatMap((g) =>
        'items' in g ? g.items.map((i) => [i.label, i.value]) : [[g.title, g.text]],
      ),
    );
    expect(lines).toMatchObject({
      Gefühlt: '-4°',
      Taupunkt: '-1°',
      Luftfeuchte: '88 %',
      Menge: '5,8 mm',
      'Stunden mit Regen': '6',
      Neuschnee: '6 cm',
      Schneehöhe: '5 cm',
      Schneefallgrenze: 'etwa 400 m',
      Mittel: '18 km/h',
      Böen: 'bis 46 km/h',
      Richtung: 'aus Nordwest',
      Bewölkung: '96 %',
      tief: '88 %',
      mittel: '72 %',
      hoch: '40 %',
      Sonnenschein: '0,4 h von 8,6 h',
      Sichtweite: '2 km',
      Luftdruck: '997 hPa, fällt',
    });
  });

  it('leaves out lines without a value and groups without lines; names the dew word and the thunder tendency', () => {
    const summer: Forecast = {
      temp: 25,
      group: 'partly',
      hours: [
        { time: '2026-07-16T15:00', temp: 25, group: 'partly', rain: 0, dew: 21, cape: 2100 },
      ],
    };
    const d: DayRow = { date: '2026-07-16', min: 15, max: 28, group: 'partly', rain: 0, mm: 0 };
    const groups = moreGroups(tp, summer, d, '2026-07-16T15:10', false);
    expect(groups).toEqual([
      { id: 'feel', title: 'Gefühl', items: [{ label: 'Taupunkt', value: '21°, drückend' }] },
      { id: 'thunder', title: 'Gewitterneigung', text: 'hoch' },
    ]);
  });

  it('names no snowfall line on a dry day or above 2 500 m', () => {
    const dry = moreGroups(tp, forecast, { ...day, mm: 0 }, '2026-11-28T12:00', false);
    expect(JSON.stringify(dry)).not.toContain('Schneefallgrenze');
    const high = { ...forecast, hours: forecast.hours!.map((r) => ({ ...r, freeze: 3200 })) };
    expect(JSON.stringify(moreGroups(tp, high, day, '2026-11-28T12:00', false))).not.toContain(
      'Schneefallgrenze',
    );
  });
});

describe('hour cards and the hour line (COPY §3)', () => {
  it('names the amount beside the chance, snow in cm', () => {
    expect(cardRain(tp, { time: 't', temp: 1, group: 'rain', rain: 60, mm: 0.8 })).toBe(
      '60 % · 0,8 mm',
    );
    expect(cardRain(tp, { time: 't', temp: 1, group: 'snow', rain: 40, mm: 0.8, snow: 1 })).toBe(
      '40 % · 1 cm',
    );
    expect(cardRain(tp, { time: 't', temp: 1, group: 'rain', rain: 60, mm: 0 })).toBe('60 %');
    expect(cardRain(tp, { time: 't', temp: 1, group: 'cloudy', rain: 10 })).toBe('');
  });

  it('the line of "Jetzt" starts with the gusts, takes the current values and leaves out what is missing', () => {
    const row = h(15, { uv: 2, night: false, vis: 8000, dew: 15, hum: 70 });
    expect(
      hourLineParts(tp, row, { gust: 31, dir: 225, hum: 86, cloud: 100, hpa: 1009 }).join(' · '),
    ).toBe(
      'Böen 31 km/h aus Südwest · Luftfeuchte 86 % · Taupunkt 15° · Bewölkung 100 % · 1009 hPa · UV 2 · Sicht 8 km',
    );
    expect(
      hourLineParts(tp, { time: 't', temp: 3, group: 'clear', rain: 0, feels: 1, vis: 24000 }),
    ).toEqual(['fühlt sich an wie 1°']);
  });
});
