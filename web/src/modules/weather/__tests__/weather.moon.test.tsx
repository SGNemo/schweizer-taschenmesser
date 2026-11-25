// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { chooseWeatherPlace, setWeatherSky } from '@/core/weather/settings';
import { AreaFrame } from '@/layout/AreaFrame';
import WeatherPage from '../routes/WeatherPage';

/**
 * Package 2 on the page: the moon card, the moon at every forecast day, the aside's name. The picture moment of
 * CONCEPT-MOON §7: 2026-11-24 01:50 UTC (02:50 in Berlin) at the sample place, the full moon's day, a supermoon.
 */
const dates = [
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29',
  '2026-11-30',
];
const hours = dates
  .slice(0, 2)
  .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const body = {
  timezone: 'Europe/Berlin',
  current: {
    time: '2026-11-24T02:50',
    temperature_2m: -4,
    weather_code: 1,
    is_day: 0,
    cloud_cover: 0,
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map(() => -4),
    weather_code: hours.map(() => 1),
    precipitation_probability: hours.map(() => 0),
  },
  daily: {
    time: dates,
    weather_code: dates.map(() => 1),
    temperature_2m_max: dates.map(() => 2),
    temperature_2m_min: dates.map(() => -3),
    precipitation_probability_max: dates.map(() => 0),
    sunrise: dates.map((d) => `${d}T07:38`),
    sunset: dates.map((d) => `${d}T16:24`),
  },
};
const ok = () =>
  vi.fn(async (url: string | URL | Request) =>
    String(url).includes('/v1/forecast')
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response('{}', { status: 500 }),
  );
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/weather']}>
      <AreaFrame>
        <WeatherPage />
      </AreaFrame>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  setNow(() => Date.parse('2026-11-24T01:50:00Z'));
  vi.stubGlobal('fetch', ok());
  await chooseWeatherPlace('Lindenau', 49.6, 11.0);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setNow();
});

describe('moon on the weather page (package 2)', () => {
  it('the card: name, lit share, moonset and moonrise in clock order, next phases, supermoon', async () => {
    renderPage();
    const card = await screen.findByTestId('weather-moon');
    expect(within(card).getByRole('heading', { name: 'Mond & Himmel' })).toBeTruthy();
    expect(card).toHaveTextContent('Vollmond');
    expect(card).toHaveTextContent('99 % beleuchtet');
    // Rise 14:43 UTC, set 06:45 UTC (CONCEPT-MOON §7), Berlin time, set first.
    expect(screen.getByTestId('weather-moon-times')).toHaveTextContent(
      'Monduntergang 07:45 · Mondaufgang 15:43',
    );
    expect(screen.getByTestId('weather-moon-next')).toHaveTextContent('Heute ist Vollmond');
    expect(screen.getByTestId('weather-moon-next')).toHaveTextContent(/Neumond am .*9/);
    expect(card).toHaveTextContent('Supermond');
    expect(card.querySelector('[data-testid="moon-glyph"]')).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Luft, Mond & Himmel' })).toBeTruthy();
  });

  it('every forecast day names its moon, as one image named "Mond: {Phase}"', async () => {
    renderPage();
    const rows = await screen.findByTestId('weather-days');
    await waitFor(() => expect(within(rows).getAllByTestId('weather-day-moon')).toHaveLength(7));
    const first = within(rows).getAllByTestId('weather-day-moon')[0]!;
    expect(first).toHaveAccessibleName('Mond: Vollmond');
    expect(first.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(
      within(rows).getAllByRole('img', { name: 'Mond: Abnehmender Mond' }).length,
    ).toBeGreaterThan(0);
  });

  it('the scene draws the full moon in the sky; switched off there is no moon anywhere', async () => {
    renderPage();
    const scene = await screen.findByTestId('weather-scene');
    await waitFor(() => expect(scene.querySelector('[data-part="moon"]')).not.toBeNull());
    cleanup();
    await setWeatherSky(false);
    renderPage();
    const off = await screen.findByTestId('weather-scene');
    await screen.findByTestId('weather-days');
    expect(off.querySelector('[data-part="moon"]')).toBeNull();
    expect(screen.queryByTestId('weather-moon')).toBeNull();
    expect(screen.queryAllByTestId('weather-day-moon')).toHaveLength(0);
    expect(screen.getByRole('complementary', { name: 'Atemwege & Allergie' })).toBeTruthy();
  });
});
