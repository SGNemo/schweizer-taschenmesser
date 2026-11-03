// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { toEpoch } from '@/core/time/dates';
import type { DayRow } from '@/core/weather/api';
import { cacheKey, clearCache, writeCache } from '@/core/weather/cache';
import { addExtraPlace, chooseWeatherPlace, getWeatherSettings } from '@/core/weather/settings';
import attention from '../attention';
import { PlacesDialog } from '../components/PlacesDialog';
import notifications from '../notifications';
import { settings as moduleSettings } from '../settings';

const TODAY = '2026-10-19';
const day = (date: string, extra: Partial<DayRow> = {}): DayRow => ({
  date,
  min: 8,
  max: 15,
  group: 'cloudy',
  rain: 10,
  ...extra,
});

async function primeForecast(days: DayRow[]) {
  await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
  const s = await getWeatherSettings();
  writeCache({
    key: cacheKey(s.lat, s.lon),
    at: Date.now(),
    forecast: { temp: 12, group: 'cloudy', days } as never,
  });
}

beforeEach(async () => {
  await db.table('_settings').clear();
  clearCache();
  setNow(() => toEpoch(TODAY, '06:00'));
});
afterEach(() => {
  setNow();
  cleanup();
});

describe('severe-weather hints', () => {
  it('"Jetzt wichtig" lists today and tomorrow from the cached forecast, as a warning (never red)', async () => {
    await primeForecast([
      day(TODAY, { max: 34 }),
      day('2026-10-20', { gust: 80 }),
      day('2026-10-22', { group: 'thunder' }), // too far ahead
    ]);
    const items = await attention({ today: TODAY });
    expect(items.map((i) => i.id)).toEqual(
      [`weather:wind:2026-10-20`, `weather:heat:${TODAY}`].sort(),
    );
    expect(items.every((i) => i.tone === 'warning' && i.to === '/weather')).toBe(true);
  });

  it('stays empty without a place, without a cached forecast of that place and for an ordinary day', async () => {
    expect(await attention({ today: TODAY })).toEqual([]);
    await primeForecast([day(TODAY)]);
    expect(await attention({ today: TODAY })).toEqual([]);
    await chooseWeatherPlace('Zürich, Schweiz', 47.3769, 8.5417); // the cache belongs to Bern
    expect(await attention({ today: TODAY })).toEqual([]);
  });
});

describe('severe-weather notification', () => {
  const range = (from: string, to: string) => ({
    from: toEpoch(TODAY, from),
    to: toEpoch(TODAY, to),
  });

  it('is off by default and says nothing then', async () => {
    expect(moduleSettings.defaults).toMatchObject({ warnNotify: false });
    await primeForecast([day(TODAY, { max: 35 })]);
    expect(await notifications(range('00:00', '23:59'))).toEqual([]);
  });

  it('sends one notification for today in the morning and one for tomorrow in the evening, local only', async () => {
    await setSettings('module.weather', { warnNotify: true });
    await primeForecast([
      day(TODAY, { max: 35, group: 'thunder' }),
      day('2026-10-20', { min: -7 }),
    ]);
    const morning = await notifications(range('07:00', '08:00'));
    expect(morning).toHaveLength(1);
    expect(morning[0]).toMatchObject({ soft: true, local: true, url: '/weather' });
    expect(morning[0]!.body).toContain('·'); // storm and heat in one text
    const evening = await notifications(range('17:00', '19:00'));
    expect(evening).toHaveLength(1);
    expect(evening[0]!.key).toContain('2026-10-20');
    // outside both slots: nothing; the same slot asked twice has the same key (no double notification)
    expect(await notifications(range('09:00', '16:00'))).toEqual([]);
    expect((await notifications(range('07:00', '08:00')))[0]!.key).toBe(morning[0]!.key);
  });
});

describe('manage places dialog', () => {
  it('renames, orders, promotes and removes places', async () => {
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    await addExtraPlace('Zürich, Schweiz', 47.3769, 8.5417);
    await addExtraPlace('Lissabon, Portugal', 38.7223, -9.1393);
    render(<PlacesDialog open onClose={() => {}} />);
    expect(await screen.findByTestId('manage-main')).toHaveTextContent('Hauptort');
    expect(screen.getAllByTestId('manage-extra')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Lissabon nach oben' }));
    await waitFor(async () =>
      expect((await getWeatherSettings()).extra[0]!.label).toBe('Lissabon, Portugal'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lissabon zum Hauptort machen' }));
    await waitFor(async () =>
      expect((await getWeatherSettings()).place).toBe('Lissabon, Portugal'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zürich entfernen' }));
    await waitFor(async () =>
      expect((await getWeatherSettings()).extra.map((p) => p.label)).toEqual(['Bern, Schweiz']),
    );
  });
});
