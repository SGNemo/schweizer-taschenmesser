import { describe, expect, it } from 'vitest';
import { beforeEach } from 'vitest';
import { db } from '@/core/db/db';
import {
  addExtraPlace,
  DEFAULT_WEATHER,
  getWeatherSettings,
  isWeatherActive,
  MAX_EXTRA_PLACES,
  removeExtraPlace,
  roundCoord,
} from './settings';

describe('weather settings', () => {
  it('is on by default but inactive without a place', () => {
    expect(DEFAULT_WEATHER.enabled).toBe(true);
    expect(isWeatherActive(DEFAULT_WEATHER)).toBe(false);
    expect(isWeatherActive({ ...DEFAULT_WEATHER, place: 'Bern' })).toBe(true);
    expect(
      isWeatherActive({ enabled: false, place: 'Bern', lat: 46.95, lon: 7.45, extra: [] }),
    ).toBe(false);
  });

  it('rounds a position to about a kilometre', () => {
    expect(roundCoord(52.520008)).toBe(52.52);
    expect(roundCoord(13.404954)).toBe(13.4);
    expect(roundCoord(-0.0049)).toBe(-0);
  });
});

describe('extra places', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
  });

  it('starts without extra places (older stored settings have no `extra` at all)', async () => {
    expect((await getWeatherSettings()).extra).toEqual([]);
  });

  it('adds up to the maximum, rounds the position and refuses duplicates and the main place', async () => {
    const { chooseWeatherPlace } = await import('./settings');
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    expect(await addExtraPlace('Bern, Schweiz', 46.9481, 7.4474)).toBe(false);
    expect(await addExtraPlace('Zürich, Schweiz', 47.3769, 8.5417)).toBe(true);
    expect(await addExtraPlace('Zürich, Schweiz', 47.3769, 8.5417)).toBe(false);
    expect(await addExtraPlace('Lissabon, Portugal', 38.7223, -9.1393)).toBe(true);
    expect(await addExtraPlace('Rom, Italien', 41.9028, 12.4964)).toBe(false);
    const s = await getWeatherSettings();
    expect(s.extra).toHaveLength(MAX_EXTRA_PLACES);
    expect(s.extra[0]).toEqual({ label: 'Zürich, Schweiz', lat: 47.38, lon: 8.54 });
  });

  it('removes one by index', async () => {
    await addExtraPlace('Zürich, Schweiz', 47.3769, 8.5417);
    await addExtraPlace('Lissabon, Portugal', 38.7223, -9.1393);
    await removeExtraPlace(0);
    expect((await getWeatherSettings()).extra.map((p) => p.label)).toEqual(['Lissabon, Portugal']);
  });
});
