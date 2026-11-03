// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { WEATHER_RETRY_MS, WEATHER_TTL_MS } from '@/core/weather/cache';
import { chooseWeatherPlace, setWeatherEnabled } from '@/core/weather/settings';
import { AreaFrame } from '@/layout/AreaFrame';
import WeatherPage from '../routes/WeatherPage';
import WeatherWidget from '../widgets/WeatherWidget';

const times = Array.from({ length: 24 }, (_, h) => `2026-10-19T${String(h).padStart(2, '0')}:00`);
const forecastBody = {
  current: { time: '2026-10-19T12:00', temperature_2m: 14.2, weather_code: 2 },
  hourly: { time: times, precipitation_probability: times.map((_, h) => (h === 15 ? 80 : 0)) },
};
const dayDates = Array.from({ length: 7 }, (_, i) => `2026-10-${19 + i}`);
const previewBody = {
  current: {
    ...forecastBody.current,
    apparent_temperature: 11.6,
    relative_humidity_2m: 71,
    wind_speed_10m: 14,
    wind_gusts_10m: 34,
    is_day: 1,
    cloud_cover: 80,
    pressure_msl: 1015.3,
    wind_direction_10m: 268,
  },
  hourly: {
    time: [...times, ...times.map((t) => t.replace('-19T', '-20T'))],
    temperature_2m: Array.from({ length: 48 }, (_, i) => 10 + (i % 5)),
    weather_code: Array.from({ length: 48 }, () => 3),
    apparent_temperature: Array.from({ length: 48 }, (_, i) => 12 + (i % 5)),
    precipitation: Array.from({ length: 48 }, (_, i) => (i === 15 ? 1.2 : 0)),
    wind_speed_10m: Array.from({ length: 48 }, () => 12),
    wind_gusts_10m: Array.from({ length: 48 }, () => 20),
    relative_humidity_2m: Array.from({ length: 48 }, () => 70),
    uv_index: Array.from({ length: 48 }, () => 0),
    cloud_cover: Array.from({ length: 48 }, () => 80),
    pressure_msl: Array.from({ length: 48 }, () => 1015),
    wind_direction_10m: Array.from({ length: 48 }, () => 268),
    is_day: Array.from({ length: 48 }, (_, i) => (i % 24 >= 7 && i % 24 < 19 ? 1 : 0)),
    precipitation_probability: Array.from({ length: 48 }, (_, i) =>
      i === 15 ? 80 : i === 16 ? 10 : 0,
    ),
  },
  daily: {
    time: dayDates,
    weather_code: dayDates.map(() => 61),
    temperature_2m_max: dayDates.map(() => 15),
    temperature_2m_min: dayDates.map(() => 7),
    precipitation_probability_max: dayDates.map((_, i) => (i === 0 ? 40 : 10)),
    sunrise: dayDates.map((d) => `${d}T07:32`),
    sunset: dayDates.map((d) => `${d}T18:21`),
    uv_index_max: dayDates.map(() => 3),
    precipitation_sum: dayDates.map(() => 1),
    precipitation_hours: dayDates.map(() => 3),
    wind_direction_10m_dominant: dayDates.map(() => 45),
    wind_speed_10m_max: dayDates.map(() => 20),
    wind_gusts_10m_max: dayDates.map(() => 35),
  },
};

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNow();
});

/** Requests that went to the forecast (the air-quality request is a second, optional one). */
const forecastCalls = (f: ReturnType<typeof vi.fn>): number =>
  f.mock.calls.filter(([u]) => String(u).includes('/v1/forecast')).length;

const renderWidget = () =>
  render(
    <MemoryRouter>
      <WeatherWidget />
    </MemoryRouter>,
  );
/** The page sits in the module frame like in the app: the head's slots (sky, temperature, hints) need it. */
const renderPage = (path = '/weather') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AreaFrame>
        <WeatherPage />
      </AreaFrame>
    </MemoryRouter>,
  );
const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe('weather widget (overview)', () => {
  it('without a place: one calm next step, nothing is asked', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    renderWidget();
    expect(await screen.findByText('Noch kein Ort gewählt.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ort wählen' })).toHaveAttribute('href', '/weather');
    await new Promise((r) => setTimeout(r, 50));
    expect(f).not.toHaveBeenCalled();
  });

  it('shows place, temperature, word and the rain hint for a chosen place', async () => {
    vi.stubGlobal('fetch', ok(forecastBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderWidget();
    const w = await screen.findByTestId('weather-widget');
    await waitFor(() => expect(w).toHaveTextContent('Bern'));
    expect(w).toHaveTextContent('14°');
    expect(w).toHaveTextContent('leicht bewölkt');
    expect(w).toHaveTextContent('ab 15 Uhr Regen');
    expect(screen.getByTestId('sky')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says "Kein Regen in Sicht" when none is expected', async () => {
    const dry = {
      ...forecastBody,
      hourly: { ...forecastBody.hourly, precipitation_probability: times.map(() => 0) },
    };
    vi.stubGlobal('fetch', ok(dry));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderWidget();
    await waitFor(() =>
      expect(screen.getByTestId('weather-widget')).toHaveTextContent('Kein Regen in Sicht'),
    );
  });

  it('switched off or not reachable: no values, no error text', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', f);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderWidget();
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.getByTestId('weather-widget')).not.toHaveTextContent('°');
    cleanup();
    f.mockClear();
    await setWeatherEnabled(false);
    renderWidget();
    await new Promise((r) => setTimeout(r, 50));
    expect(f).not.toHaveBeenCalled();
  });

  it('does not ask again for a few minutes after a failed request', async () => {
    const T0 = Date.UTC(2026, 9, 19, 10, 0, 0);
    setNow(() => T0);
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', f);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderWidget();
    await waitFor(() => expect(forecastCalls(f)).toBe(1));
    await waitFor(() => expect(localStorage.getItem('tm-weather-tried')).toContain('"at"'));
    cleanup();
    renderWidget(); // a reload a minute later: no new request
    await new Promise((r) => setTimeout(r, 50));
    expect(forecastCalls(f)).toBe(1);
    cleanup();
    setNow(() => T0 + WEATHER_RETRY_MS);
    renderWidget(); // after the retry window it asks once more
    await waitFor(() => expect(forecastCalls(f)).toBe(2));
  });

  it('offline: asks nothing and shows the old values with "Stand hh:mm"', async () => {
    const t0 = new Date(2026, 9, 19, 10, 5).getTime();
    setNow(() => t0);
    localStorage.setItem(
      'tm-weather',
      JSON.stringify({
        key: '46.95,7.45',
        at: t0 - 2 * WEATHER_TTL_MS,
        forecast: { temp: 9, group: 'rain', rainFrom: '15' },
      }),
    );
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderWidget();
    await waitFor(() =>
      expect(screen.getByTestId('weather-widget')).toHaveTextContent(/9°.*Regen.*Stand 0?9:05/),
    );
    expect(f).not.toHaveBeenCalled();
  });
});

describe('weather page', () => {
  const at1205 = () => setNow(() => new Date(2026, 9, 19, 12, 5).getTime());

  it('without a place: one calm next step to the settings, nothing is asked', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    renderPage();
    const empty = await screen.findByTestId('weather-empty');
    expect(empty).toHaveTextContent('Wähle deinen Ort');
    expect(within(empty).getByRole('link')).toHaveAttribute(
      'href',
      '/settings/verbindungen#weather',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(f).not.toHaveBeenCalled();
  });

  it('the title (h1) is the place, in the module head; the sky is behind it', async () => {
    at1205();
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const frame = await screen.findByTestId('module-frame');
    expect(await within(frame).findByRole('heading', { level: 1, name: 'Bern' })).toBeTruthy();
    await waitFor(() =>
      expect(within(frame).getByTestId('sky')).toHaveAttribute('data-sky', 'cloudy'),
    );
    expect(frame).toHaveAttribute('data-signature', 'sky');
  });

  it('24 hour cards and 7 days; rain only from 30 %, the rating always with its word', async () => {
    at1205();
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const hoursList = await screen.findByTestId('weather-hours');
    const hours = hoursList.querySelectorAll('li');
    const days = screen.getByTestId('weather-days').querySelectorAll('li');
    expect(hours).toHaveLength(24);
    expect(days).toHaveLength(7);
    expect(hours[0]).toHaveTextContent('12:00');
    expect(hours[0]).toHaveTextContent('bedeckt');
    expect(hours[0]).toHaveTextContent('Wind 12 km/h');
    expect(hours[3]).toHaveTextContent('15:00');
    expect(hours[3]).toHaveTextContent('80 %');
    expect(hours[4]).not.toHaveTextContent('%');
    expect(days[0]).toHaveTextContent('Heute');
    expect(days[0]).toHaveTextContent('Regen 40 %');
    expect(days[1]).not.toHaveTextContent('Regen 10');
    for (const li of days)
      expect(li.querySelector('[data-rating]')?.textContent).toMatch(/Gut|Geht so|Ungemütlich/);
    expect(hours[3]).toHaveAttribute('data-rating', 'poor');
    expect(screen.getByRole('region', { name: 'Stunde für Stunde' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('colours only carry meaning and always sit next to words: rain blue with its percentage, temperature tone', async () => {
    at1205();
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const hours = (await screen.findByTestId('weather-hours')).querySelectorAll('li');
    expect(hours[3]!.querySelector('[data-tone]')).toHaveTextContent('°');
    const days = screen.getByTestId('weather-days').querySelectorAll('li');
    expect(days[0]!.querySelector('[data-kind="rain"]')).toHaveTextContent('Regen 40 %');
    // The head's chips carry an icon each, next to their words.
    const now = await screen.findByTestId('weather-now');
    expect(now.querySelectorAll('li svg').length).toBeGreaterThanOrEqual(2);
  });

  it('the head: temperature, "fühlt sich an wie", the word, three facts, the rest as one line', async () => {
    at1205();
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const now = await screen.findByTestId('weather-now');
    await waitFor(() => expect(now).toHaveTextContent('14°'));
    expect(now).toHaveTextContent('fühlt sich an wie 12°');
    expect(now).toHaveTextContent('bedeckt'.replace('bedeckt', 'leicht bewölkt'));
    expect(now).toHaveTextContent('Regen ab 15 Uhr');
    expect(now).toHaveTextContent('Wind 14 km/h W');
    expect(now).toHaveTextContent('UV 3');
    expect(now).toHaveTextContent('7° / 15°');
    expect(now).toHaveTextContent('Luftfeuchte 71 %');
    expect(now).toHaveTextContent('Böen 34 km/h');
    expect(now).toHaveTextContent('Bewölkung 80 %');
    expect(now).toHaveTextContent('1015 hPa');
    expect(now).toHaveTextContent('Sonne 07:32–18:21');
    expect(now).toHaveTextContent(/Beste Zeit: \d\d–\d\d Uhr/);
    // Chart: a picture with a label, rain bars and the wind line are in it.
    const chart = screen.getByTestId('weather-chart');
    expect(chart.querySelector('svg')?.getAttribute('role')).toBe('img');
    expect(chart).toHaveTextContent('Wind');
    expect(chart).toHaveTextContent('Nacht');
    expect(screen.getByTestId('weather-days').querySelector('li')).toHaveTextContent(
      '3 h Niederschlag',
    );
    expect(screen.getByTestId('weather-days').querySelector('li')).toHaveTextContent(
      'Wind 20 km/h NO',
    );
  });

  it('a hint above the head when a day calls for it (gusts), with what it is based on', async () => {
    at1205();
    const windy = {
      ...previewBody,
      daily: {
        ...previewBody.daily,
        wind_gusts_10m_max: dayDates.map((_, i) => (i === 2 ? 78 : 35)),
      },
    };
    vi.stubGlobal('fetch', ok(windy));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const warn = await screen.findByTestId('weather-warning');
    expect(warn).toHaveTextContent('Sturmböen bis 78 km/h');
    expect(warn).toHaveTextContent('keine amtliche Warnung');
  });

  it('no hint for an ordinary week', async () => {
    at1205();
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    await screen.findByTestId('weather-hours');
    expect(screen.queryByTestId('weather-warning')).toBeNull();
  });

  it('air quality and pollen sit in the aside, strongest first, and the pollen of coming days', async () => {
    at1205();
    const airBody = {
      current: {
        european_aqi: 52,
        pm2_5: 12.4,
        ozone: 80,
        birch_pollen: 120,
        grass_pollen: 3,
        alder_pollen: 0,
      },
      hourly: {
        time: dayDates.map((d) => `${d}T12:00`),
        birch_pollen: dayDates.map((_, i) => (i === 1 ? 200 : 5)),
        grass_pollen: dayDates.map(() => 3),
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: RequestInfo | URL) =>
          new Response(
            JSON.stringify(String(url).includes('air-quality') ? airBody : previewBody),
            { status: 200 },
          ),
      ),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    const air = await screen.findByTestId('weather-air');
    expect(air).toHaveTextContent('Atemwege & Allergie');
    expect(screen.getByTestId('weather-aqi')).toHaveTextContent('Luftqualität 52mäßig');
    expect(air).toHaveTextContent('Feinstaub PM2,5');
    const rows = screen.getByTestId('weather-pollen').querySelectorAll('li');
    expect(rows[0]).toHaveTextContent('Birke');
    expect(rows[0]).toHaveTextContent('hoch');
    expect(rows[0]).toHaveTextContent('120 Pollen/m³');
    expect(rows[rows.length - 1]).toHaveTextContent('Erle');
    expect(air.querySelector('[data-rating]')).toHaveTextContent('Ungemütlich');
    const days = screen.getByTestId('weather-days').querySelectorAll('li');
    expect(days[1]).toHaveTextContent('Pollen: Birke hoch');
    expect(days[0]).not.toHaveTextContent('Pollen:');
  });

  it('without air values: one calm sentence, the weather stays complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).includes('air-quality')
          ? new Response('x', { status: 500 })
          : new Response(JSON.stringify(previewBody), { status: 200 }),
      ),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    expect(await screen.findByTestId('weather-air')).toHaveTextContent(
      'Luft- und Pollenwerte sind gerade nicht verfügbar.',
    );
    expect(screen.getByTestId('weather-hours').querySelectorAll('li')).toHaveLength(24);
  });

  it('links to the weather settings and credits Open-Meteo', async () => {
    vi.stubGlobal('fetch', ok(previewBody));
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    await screen.findByTestId('weather-hours');
    expect(screen.getByRole('link', { name: 'Einstellungen' }).getAttribute('href')).toBe(
      '/settings/verbindungen#weather',
    );
    expect(screen.getByTestId('weather-preview-credit')).toHaveTextContent('Open-Meteo.com');
  });

  it('offline: the last values stay with "Stand hh:mm" and nothing is asked', async () => {
    const t0 = new Date(2026, 9, 19, 12, 5).getTime();
    setNow(() => t0);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    localStorage.setItem(
      'tm-weather',
      JSON.stringify({
        key: '46.95,7.45',
        at: t0 - 2 * WEATHER_TTL_MS,
        forecast: {
          temp: 9,
          group: 'rain',
          time: '2026-10-19T11:05',
          hours: [{ time: '2026-10-19T12:00', temp: 9, group: 'rain', rain: 90 }],
          days: [{ date: '2026-10-19', min: 4, max: 11, group: 'rain', rain: 90 }],
        },
      }),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderPage();
    const now = await screen.findByTestId('weather-now');
    expect(now).toHaveTextContent(/Stand 0?11:05/);
    expect(screen.getByTestId('weather-hours').querySelectorAll('li')).toHaveLength(1);
    expect(f).not.toHaveBeenCalled();
  });

  it('an old cached value without preview data: "Wird geladen", one request, then the cards', async () => {
    const t0 = new Date(2026, 9, 19, 12, 5).getTime();
    setNow(() => t0);
    localStorage.setItem(
      'tm-weather',
      JSON.stringify({ key: '46.95,7.45', at: t0, forecast: { temp: 9, group: 'rain' } }),
    );
    const f = ok(previewBody);
    vi.stubGlobal('fetch', f);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderPage();
    expect(await screen.findByText('Wird geladen …')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('weather-hours')).toBeTruthy());
    expect(forecastCalls(f)).toBe(1);
  });

  it('no data and offline: one calm sentence instead of an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderPage();
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.queryByTestId('weather-hours')).toBeNull();
  });
});

describe('more places', () => {
  it('chips for the main place and extras; "Ort hinzufügen" searches and adds; × removes; three at most', async () => {
    setNow(() => new Date(2026, 9, 19, 12, 5).getTime());
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('geocoding'))
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: 'Zürich',
                  admin1: 'Zürich',
                  country: 'Schweiz',
                  latitude: 47.3769,
                  longitude: 8.5417,
                },
              ],
            }),
            { status: 200 },
          );
        return new Response(JSON.stringify(previewBody), { status: 200 });
      }),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderPage();
    await screen.findByTestId('module-frame'); // the page re-mounts once when the module frame is known
    const nav = await screen.findByRole('navigation', { name: 'Orte' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    const add = within(nav).getByTestId('weather-add-place');
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    const field = await screen.findByLabelText('Ort suchen');
    fireEvent.change(field, { target: { value: 'Zürich' } });
    fireEvent.submit(field.closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: /Zürich.*wählen/ }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Orte' })).getAllByRole('link'),
      ).toHaveLength(2),
    );
    fireEvent.click(screen.getByRole('button', { name: /Zürich.*entfernen/ }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Orte' })).getAllByRole('link'),
      ).toHaveLength(1),
    );
  });
});
