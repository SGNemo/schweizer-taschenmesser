// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { chooseWeatherPlace, setWeatherSky } from '@/core/weather/settings';
import { AreaFrame } from '@/layout/AreaFrame';
import WeatherPage from '../routes/WeatherPage';

/**
 * Package 3 on the page (CONCEPT-EVENTS §4, sample place Lindenau 49.6° N 11.0° E): the partial solar eclipse of
 * 2027-08-02 (chip, safety pill, "Als Nächstes" from 26 July), the total lunar eclipse of 2028-12-31 (the moon rises
 * late), Saharan dust, and nothing of it with "Mond und Himmelsereignisse" off.
 */
function bodyFor(
  nowLocal: string,
  o: { code?: number; isDay?: 0 | 1; dust?: number; gust?: number; max?: number } = {},
) {
  const start = Date.parse(`${nowLocal.slice(0, 10)}T12:00:00Z`);
  const dates = Array.from({ length: 7 }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10),
  );
  const hours = dates
    .slice(0, 2)
    .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  return {
    timezone: 'Europe/Berlin',
    current: {
      time: nowLocal,
      temperature_2m: 20,
      weather_code: o.code ?? 1,
      is_day: o.isDay ?? 1,
      cloud_cover: 10,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => 20),
      weather_code: hours.map(() => o.code ?? 1),
      precipitation_probability: hours.map(() => 0),
      cloud_cover: hours.map(() => 10),
    },
    daily: {
      time: dates,
      weather_code: dates.map(() => o.code ?? 1),
      temperature_2m_max: dates.map(() => o.max ?? 24),
      temperature_2m_min: dates.map(() => 12),
      precipitation_probability_max: dates.map(() => 0),
      wind_gusts_10m_max: dates.map(() => o.gust ?? 10),
      sunrise: dates.map((d) => `${d}T05:50`),
      sunset: dates.map((d) => `${d}T20:50`),
    },
    air: { current: { european_aqi: 20, dust: o.dust ?? 5 } },
  };
}

let body = bodyFor('2027-08-02T07:00');
const stub = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/v1/forecast')
        ? new Response(JSON.stringify(body), { status: 200 })
        : String(url).includes('air-quality')
          ? new Response(JSON.stringify(body.air), { status: 200 })
          : new Response('{}', { status: 500 }),
    ),
  );
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/weather']}>
      <AreaFrame>
        <WeatherPage />
      </AreaFrame>
    </MemoryRouter>,
  );
const at = async (utc: string, local: string, o?: Parameters<typeof bodyFor>[1]) => {
  setNow(() => Date.parse(utc));
  body = bodyFor(local, o);
  stub();
  await chooseWeatherPlace('Lindenau', 49.6, 11.0);
};

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setNow();
});

describe('sky events on the weather page (package 3)', () => {
  it('the morning of 2027-08-02: the eclipse chip, the safety pill in the stage, "Als Nächstes" with its facts', async () => {
    await at('2027-08-02T05:00:00Z', '2027-08-02T07:00');
    renderPage();
    const keys = await screen.findByTestId('weather-keys');
    expect(keys).toHaveTextContent('Sonnenfinsternis 10:10–12:14');
    expect(within(keys).getAllByTestId('event-glyph')[0]).toHaveAttribute('data-glyph', 'eclipse');
    const pill = screen.getByTestId('weather-safety');
    expect(pill).toHaveAttribute('role', 'note');
    expect(pill).toHaveTextContent(
      'Nur mit Sonnenfinsternis-Brille hinsehen, nie mit bloßem Auge oder Sonnenbrille.',
    );
    expect(pill).not.toHaveTextContent('berechnet');
    const next = await screen.findByTestId('weather-sky-next');
    expect(next).toHaveTextContent('Als Nächstes');
    expect(next).toHaveTextContent('Heute: Partielle Sonnenfinsternis · 10:10–12:14');
    expect(next).toHaveTextContent('Höhepunkt 11:11 · hier bis 45 % der Sonne bedeckt');
    expect(within(next).getByTestId('weather-sky-safety')).toBeTruthy();
  });

  it('on an eclipse day the stage holds the safety pill and one weather hint; the second goes under the head', async () => {
    await at('2027-08-02T05:00:00Z', '2027-08-02T07:00', { gust: 90, max: 36 });
    renderPage();
    const stage = await screen.findByTestId('weather-now');
    await within(stage).findByTestId('weather-safety');
    const inStage = within(stage).getByTestId('weather-warning');
    expect(within(inStage).getAllByRole('listitem')).toHaveLength(1);
    const below = within(screen.getByTestId('weather-late-warning')).getByTestId('weather-warning');
    expect(within(below).getAllByRole('listitem')).toHaveLength(1);
  });

  it('a week ahead, from 26 July: the card names the day; no chip, no pill', async () => {
    await at('2027-07-26T10:00:00Z', '2027-07-26T12:00');
    renderPage();
    const next = await screen.findByTestId('weather-sky-next');
    expect(next).toHaveTextContent(/Partielle Sonnenfinsternis am Mo\., 2\. Aug\. · 10:10–12:14/);
    expect(screen.queryByTestId('weather-safety')).toBeNull();
    expect(screen.getByTestId('weather-keys')).not.toHaveTextContent('Sonnenfinsternis');
  });

  it('2028-12-31: the moon rises during the eclipse', async () => {
    await at('2028-12-31T12:00:00Z', '2028-12-31T13:00', { isDay: 1 });
    renderPage();
    const next = await screen.findByTestId('weather-sky-next');
    // The table keeps whole minutes of the half-durations: totality ends 17:27 here (17:28:02 in the truth).
    expect(next).toHaveTextContent('Heute Nacht: Totale Mondfinsternis · 16:06–19:36');
    expect(next).toHaveTextContent('ganz im Schatten 17:15–18:27');
    expect(next).toHaveTextContent(
      /Der Mond geht hier erst um \d\d:\d\d auf, den Anfang sieht man nicht\./,
    );
  });

  it('Saharan dust: a row under the particles; switched off: no event anywhere', async () => {
    await at('2027-08-02T05:00:00Z', '2027-08-02T07:00', { dust: 86 });
    renderPage();
    expect(await screen.findByTestId('weather-dust')).toHaveTextContent(
      'Saharastaub in der Luft (86 µg/m³): der Himmel wirkt milchig.',
    );
    cleanup();
    await setWeatherSky(false);
    renderPage();
    await screen.findByTestId('weather-keys');
    expect(screen.queryByTestId('weather-dust')).toBeNull();
    expect(screen.queryByTestId('weather-safety')).toBeNull();
    expect(screen.queryByTestId('weather-sky-next')).toBeNull();
    expect(screen.getByTestId('weather-keys')).not.toHaveTextContent('Sonnenfinsternis');
  });
});
