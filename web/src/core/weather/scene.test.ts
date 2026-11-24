import { describe, expect, it } from 'vitest';
import { tWeather } from '@/strings.weather';
import { codeGroup, type CodeGroup } from './logic';
import { conditionId, sceneAddition, WMO_CODES } from './scene';

/** Every code Open-Meteo documents for `weather_code` (WMO 4677 subset). */
const OPEN_METEO_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
];
const GROUPS = Object.keys(tWeather.de.codes) as CodeGroup[];

describe('conditionId', () => {
  it('has an id for every Open-Meteo code, and only for those', () => {
    expect([...WMO_CODES].sort((a, b) => a - b)).toEqual(OPEN_METEO_CODES);
  });

  it.each([
    [0, 'clear', 'klar', 'clear'],
    [1, 'mostlyClear', 'überwiegend klar', 'mostly clear'],
    [2, 'partly', 'leicht bewölkt', 'partly cloudy'],
    [3, 'overcast', 'bedeckt', 'overcast'],
    [45, 'fog', 'Nebel', 'fog'],
    [48, 'rimeFog', 'Nebel mit Reif', 'freezing fog'],
    [51, 'drizzle', 'Nieselregen', 'drizzle'],
    [53, 'drizzle', 'Nieselregen', 'drizzle'],
    [55, 'drizzle', 'Nieselregen', 'drizzle'],
    [56, 'freezingDrizzle', 'gefrierender Niesel', 'freezing drizzle'],
    [57, 'freezingDrizzle', 'gefrierender Niesel', 'freezing drizzle'],
    [61, 'rainLight', 'leichter Regen', 'light rain'],
    [63, 'rain', 'Regen', 'rain'],
    [65, 'rainHeavy', 'starker Regen', 'heavy rain'],
    [66, 'freezingRain', 'gefrierender Regen', 'freezing rain'],
    [67, 'freezingRain', 'gefrierender Regen', 'freezing rain'],
    [71, 'snowLight', 'leichter Schneefall', 'light snow'],
    [73, 'snow', 'Schneefall', 'snow'],
    [75, 'snowHeavy', 'starker Schneefall', 'heavy snow'],
    [77, 'snowGrains', 'Schneegriesel', 'snow grains'],
    [80, 'showersLight', 'leichte Schauer', 'light showers'],
    [81, 'showers', 'Schauer', 'showers'],
    [82, 'showersHeavy', 'heftige Schauer', 'heavy showers'],
    [85, 'snowShowers', 'Schneeschauer', 'snow showers'],
    [86, 'snowShowers', 'Schneeschauer', 'snow showers'],
    [95, 'thunder', 'Gewitter', 'thunderstorm'],
    [96, 'thunderHail', 'Gewitter mit Hagel', 'thunderstorm with hail'],
    [99, 'thunderHail', 'Gewitter mit Hagel', 'thunderstorm with hail'],
  ] as const)('code %i → %s (%s / %s)', (code, id, de, en) => {
    expect(conditionId(code, codeGroup(code))).toBe(id);
    expect(tWeather.de.conditions[id]).toBe(de);
    expect(tWeather.en.conditions[id]).toBe(en);
  });

  it('without a code: the group’s nearest word', () => {
    const byGroup = Object.fromEntries(GROUPS.map((g) => [g, conditionId(undefined, g)]));
    expect(byGroup).toEqual({
      clear: 'clear',
      partly: 'partly',
      cloudy: 'overcast',
      fog: 'fog',
      drizzle: 'drizzle',
      rain: 'rain',
      showers: 'showers',
      snow: 'snow',
      thunder: 'thunder',
    });
    // The group's old word and the new one agree where no code is known.
    for (const g of GROUPS)
      if (g !== 'snow')
        expect(tWeather.de.conditions[conditionId(undefined, g)]).toBe(tWeather.de.codes[g]);
  });

  it('an unknown code falls back to its group', () => {
    expect(conditionId(4, 'cloudy')).toBe('overcast');
  });

  it('German and English have a word for every id', () => {
    expect(Object.keys(tWeather.en.conditions).sort()).toEqual(
      Object.keys(tWeather.de.conditions).sort(),
    );
    for (const w of [
      ...Object.values(tWeather.de.conditions),
      ...Object.values(tWeather.en.conditions),
    ])
      expect(w.length).toBeGreaterThan(0);
  });
});

describe('sceneAddition (one extra word, by priority)', () => {
  const base = { id: 'clear' as const, temp: 10 };
  it('gale-force gusts from wind 50 or gusts 70', () => {
    expect(sceneAddition({ ...base, wind: 50 })).toBe('storm');
    expect(sceneAddition({ ...base, gust: 70, temp: -8, snowDepth: 0.2 })).toBe('storm');
    expect(sceneAddition({ ...base, gust: 69 })).toBe('windy');
  });
  it('windy from gusts 50 or wind 35', () => {
    expect(sceneAddition({ ...base, gust: 50 })).toBe('windy');
    expect(sceneAddition({ ...base, wind: 35 })).toBe('windy');
    expect(sceneAddition({ ...base, wind: 34, gust: 49 })).toBeUndefined();
  });
  it('snow on the ground from 1 cm, not beside a snow word', () => {
    expect(sceneAddition({ ...base, snowDepth: 0.01 })).toBe('snowLies');
    expect(sceneAddition({ ...base, snowDepth: 0.009 })).toBeUndefined();
    expect(sceneAddition({ ...base, id: 'snow', snowDepth: 0.3, temp: -3 })).toBeUndefined();
    expect(sceneAddition({ ...base, temp: -3, snowDepth: 0.05 })).toBe('snowLies');
  });
  it('frost at 0° and below, not beside a snow word', () => {
    expect(sceneAddition({ ...base, temp: 0 })).toBe('frost');
    expect(sceneAddition({ ...base, temp: -4, id: 'snowGrains' })).toBeUndefined();
    expect(sceneAddition({ ...base, temp: 1 })).toBeUndefined();
  });
  it('heat from 30° by day only', () => {
    expect(sceneAddition({ ...base, temp: 30 })).toBe('heat');
    expect(sceneAddition({ ...base, temp: 31, night: true })).toBeUndefined();
  });
});
