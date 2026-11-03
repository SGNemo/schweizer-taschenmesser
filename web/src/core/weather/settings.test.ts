import { describe, expect, it } from 'vitest';
import { beforeEach } from 'vitest';
import { db } from '@/core/db/db';
import {
  addExtraPlace,
  DEFAULT_WEATHER,
  getWeatherSettings,
  isWeatherActive,
  MAX_EXTRA_PLACES,
  moveExtraPlace,
  promoteExtraPlace,
  removeExtraPlace,
  renamePlace,
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
    expect(await addExtraPlace('Rom, Italien', 41.9028, 12.4964)).toBe(true);
    expect(await addExtraPlace('Wien, Österreich', 48.2082, 16.3738)).toBe(true);
    // the cap: one more than the maximum is refused
    expect(await addExtraPlace('Prag, Tschechien', 50.0755, 14.4378)).toBe(false);
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

describe('managing places', () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
    const { chooseWeatherPlace } = await import('./settings');
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    await addExtraPlace('Zürich, Schweiz', 47.3769, 8.5417);
    await addExtraPlace('Lissabon, Portugal', 38.7223, -9.1393);
  });

  it('moves an extra place up and down, never out of range', async () => {
    await moveExtraPlace(1, -1);
    expect((await getWeatherSettings()).extra.map((p) => p.label)).toEqual([
      'Lissabon, Portugal',
      'Zürich, Schweiz',
    ]);
    await moveExtraPlace(0, -1);
    await moveExtraPlace(1, 1);
    expect((await getWeatherSettings()).extra.map((p) => p.label)).toEqual([
      'Lissabon, Portugal',
      'Zürich, Schweiz',
    ]);
  });

  it('promotes an extra place to the main place; the old main place takes its slot', async () => {
    await promoteExtraPlace(1);
    const s = await getWeatherSettings();
    expect([s.place, s.lat, s.lon]).toEqual(['Lissabon, Portugal', 38.72, -9.14]);
    expect(s.extra.map((p) => p.label)).toEqual(['Zürich, Schweiz', 'Bern, Schweiz']);
    expect(s.extra[1]).toEqual({ label: 'Bern, Schweiz', lat: 46.95, lon: 7.45 });
  });

  it('renames the main place and an extra place; a blank name changes nothing', async () => {
    await renamePlace(0, ' Zuhause ');
    await renamePlace(2, 'Urlaub');
    await renamePlace(1, '   ');
    await renamePlace(9, 'Nirgends');
    const s = await getWeatherSettings();
    expect(s.place).toBe('Zuhause');
    expect(s.extra.map((p) => p.label)).toEqual(['Zürich, Schweiz', 'Urlaub']);
    expect([s.lat, s.lon]).toEqual([46.95, 7.45]);
  });
});
