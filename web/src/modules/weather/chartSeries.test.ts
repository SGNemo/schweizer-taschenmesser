// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { HourRow } from '@/core/weather/api';
import { tWeatherPage } from '@/strings.weatherPage';
import {
  CHART_KEY,
  CHART_OPTIONS,
  readChartChoice,
  seriesOf,
  writeChartChoice,
  type ChartOption,
} from './chartSeries';

const tp = tWeatherPage.get();
const full = (i: number): HourRow => ({
  time: `2026-07-16T${String(i).padStart(2, '0')}:00`,
  temp: 14 + (i % 6),
  feels: 13 + (i % 6),
  group: 'cloudy',
  rain: i === 15 ? 60 : 0,
  mm: i === 15 ? 0.8 : 0,
  wind: 5 + (i % 3),
  gust: 12 + (i % 4),
  dir: 225,
  cloud: 40 + i,
  sunMin: i >= 8 && i < 18 ? 30 : 0,
  hpa: 1012 + (i >= 12 ? 2 : 0),
  uv: i >= 8 && i < 18 ? (i === 13 ? 6 : 2) : 0,
  night: i < 6 || i >= 22,
});
const hours = Array.from({ length: 24 }, (_, i) => full(i));
const bare = hours.map(({ time, temp, group, rain }) => ({ time, temp, group, rain }));
const air = {
  now: {},
  pollen: {},
  days: [],
  hours: hours.slice(0, 10).map((h, i) => ({ t: h.time, aqi: 20 + i })),
};

afterEach(() => localStorage.clear());

describe('the six series of the curve: with data, without data, and the text alternative', () => {
  const withData: Record<ChartOption, RegExp> = {
    tempRain:
      /^Temperatur von 14° bis 19°, am wärmsten um 05 Uhr; Regen zusammen etwa 0,8 mm, am meisten um 15 Uhr\.$/,
    wind: /^Wind von 5 bis 7 km\/h, Böen bis 15 km\/h um 03 Uhr\.$/,
    sun: /^Sonnenschein zusammen 5 h, Bewölkung zwischen 40 und 63 %\.$/,
    pressure: /^Luftdruck von 1012 bis 1014 hPa\.$/,
    uv: /^UV bis 6 um 13 Uhr\.$/,
    air: /^Luftqualitätsindex von 20 bis 29\.$/,
  };
  it.each(CHART_OPTIONS)('%s', (option) => {
    const s = seriesOf(tp, option, hours, air);
    expect(s.has).toBe(true);
    expect(s.alt).toMatch(withData[option]);
    const none = seriesOf(
      tp,
      option,
      bare.slice(0, 2).map((h) => ({ ...h, temp: h.temp })),
      undefined,
    );
    if (option === 'tempRain') {
      // Temperature is always there; without amounts it says "kein Regen" and draws no felt line.
      expect(none.has).toBe(true);
      expect(none.line2).toBeUndefined();
      expect(none.alt).toMatch(/kein Regen\.$/);
    } else {
      expect(none.has).toBe(false);
      expect(none.alt).toBe(option === 'air' ? tp.airMissing : tp.hourMissing);
    }
  });

  it('the wind series draws arrows (direction) and starts at 0', () => {
    const s = seriesOf(tp, 'wind', hours);
    expect(s.arrows?.every((d) => d === 225)).toBe(true);
    expect(s.top?.lo).toBe(0);
  });

  it('UV draws bars by day only', () => {
    const s = seriesOf(tp, 'uv', hours);
    expect(s.topBars?.[2]).toBeNull();
    expect(s.topBars?.[13]).toBe(6);
  });

  it('pressure names the tendency of the first hour', () => {
    const rising = hours.map((h, i) => ({ ...h, hpa: 1000 + i }));
    const s = seriesOf(tp, 'pressure', rising.slice(3), undefined, rising);
    expect(s.word).toBe('steigt');
    expect(s.alt).toBe('Luftdruck von 1003 bis 1023 hPa, steigt.');
  });

  it('air ends where its five days end (the line stops)', () => {
    const s = seriesOf(tp, 'air', hours, air);
    expect(s.line?.slice(9, 11)).toEqual([29, null]);
  });
});

describe('the choice of the curve is device-local', () => {
  it('reads the default without a stored value and keeps a valid choice', () => {
    expect(readChartChoice()).toBe('tempRain');
    writeChartChoice('wind');
    expect(localStorage.getItem(CHART_KEY)).toBe('wind');
    expect(readChartChoice()).toBe('wind');
    writeChartChoice('tempRain');
    expect(localStorage.getItem(CHART_KEY)).toBeNull();
  });

  it('a foreign stored value reads as the default', () => {
    localStorage.setItem(CHART_KEY, 'radar');
    expect(readChartChoice()).toBe('tempRain');
  });
});
