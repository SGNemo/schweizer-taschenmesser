// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { now, setNow } from '@/core/time/now';
import { cacheKey, writeCache } from '@/core/weather/cache';
import {
  chooseWeatherPlace,
  getWeatherSettings,
  setWeatherScene,
  setWeatherSky,
} from '@/core/weather/settings';
import WeatherWidget from '../widgets/WeatherWidget';

/**
 * Weather scenes 4 (handoff 04): the widget carries the scene as the card's background (variant B); "Ruhig" and
 * "Modulfarben: Aus" keep the plain card with the 64 px porthole (variant A). Neither moves; both follow "Bild im
 * Wetter-Kopf" ("Schlicht") and "Mond und Himmelsereignisse".
 */
const root = document.documentElement;
beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  // 23:30 at the place, a clear night with the moon up (2026-11-24: waxing, about 4/5 lit)
  setNow(() => new Date(2026, 10, 24, 23, 30).getTime());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setNow();
  delete root.dataset.color;
  delete root.dataset.moduleColors;
});

async function cached(forecast: Record<string, unknown> = {}) {
  await chooseWeatherPlace('Lindenau', 50.1, 10.2);
  const s = await getWeatherSettings();
  writeCache({
    key: cacheKey(s.lat, s.lon),
    at: now(),
    forecast: {
      temp: -4,
      group: 'clear',
      code: 0,
      time: '2026-11-24T23:30',
      rainFrom: '15',
      now: { night: true, cloud: 5 },
      days: [
        {
          date: '2026-11-24',
          min: -6,
          max: 2,
          group: 'clear',
          rain: 0,
          sunrise: '07:40',
          sunset: '16:25',
        },
      ],
      ...forecast,
    },
  });
}
const renderWidget = () =>
  render(
    <MemoryRouter>
      <WeatherWidget />
    </MemoryRouter>,
  );

describe('weather widget: scene as the background (variant B) or the porthole (variant A)', () => {
  it('B: the scene behind the card, never moving, text and the rain chip on it', async () => {
    await cached();
    renderWidget();
    const w = await screen.findByTestId('weather-widget');
    await waitFor(() => expect(w).toHaveAttribute('data-variant', 'scene'));
    const scene = within(w).getByTestId('weather-scene');
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    expect(scene).not.toHaveAttribute('data-motion');
    expect(scene).toHaveAttribute('data-phase', 'night');
    expect(w).toHaveAttribute('data-ink', 'light');
    expect(within(w).queryByTestId('scene-porthole')).toBeNull();
    expect(w).toHaveTextContent('Lindenau');
    expect(w).toHaveTextContent('-4°');
    expect(w).toHaveTextContent('klar');
    // the rain hint is its own opaque chip, no longer part of the context line
    const chip = within(w).getByText('ab 15 Uhr Regen', { exact: false });
    expect(chip.tagName).toBe('SPAN');
    // the moon of the page (`useMoon`) is in the scene
    await waitFor(() => expect(scene.querySelector('[data-part="moon"]')).not.toBeNull());
  });

  it('a wide card (sizes m and l) keeps the porthole: the panorama is checked for the one-column card only', async () => {
    await cached();
    const RO = class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb();
      }
      disconnect() {}
    };
    vi.stubGlobal('ResizeObserver', RO);
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 780, height: 205 } as DOMRect);
    renderWidget();
    const w = await screen.findByTestId('weather-widget');
    await waitFor(() => expect(w).toHaveAttribute('data-variant', 'porthole'));
    rect.mockRestore();
    vi.unstubAllGlobals();
  });

  it.each([
    ['"Ruhig"', () => (root.dataset.color = 'calm')],
    ['"Modulfarben: Aus"', () => (root.dataset.moduleColors = 'off')],
  ])('A in %s: the plain card with the 64 px porthole where the swatch was', async (_, set) => {
    set();
    await cached();
    renderWidget();
    const w = await screen.findByTestId('weather-widget');
    await waitFor(() => expect(w).toHaveAttribute('data-variant', 'porthole'));
    const p = within(w).getByTestId('scene-porthole');
    expect(p).toHaveAttribute('data-size', '64');
    expect(p).toHaveAttribute('aria-hidden', 'true');
    expect(p.querySelector('svg')).not.toHaveAttribute('data-motion');
    expect(within(w).queryByTestId('weather-scene')).toBeNull();
    // the card is unchanged: the rain hint stays in the context line
    expect(w).toHaveTextContent('-4°');
    expect(w).toHaveTextContent('klar · ab 15 Uhr Regen');
  });

  it('"Schlicht" draws sky and body only; "Mond und Himmelsereignisse" off draws no moon', async () => {
    await cached();
    await setWeatherScene('plain');
    renderWidget();
    const w = await screen.findByTestId('weather-widget');
    const scene = await within(w).findByTestId('weather-scene');
    await waitFor(() => expect(scene).toHaveAttribute('data-level', 'plain'));
    const layers = [...scene.querySelectorAll('[data-layer]')].map((g) =>
      g.getAttribute('data-layer'),
    );
    expect(layers.every((l) => l === 'sky' || l === 'body')).toBe(true);
    cleanup();
    await setWeatherSky(false);
    root.dataset.color = 'calm';
    renderWidget();
    const p = await screen.findByTestId('scene-porthole');
    await waitFor(() => expect(p.querySelector('svg')).toHaveAttribute('data-level', 'plain'));
    expect(p.querySelector('[data-part="moon"]')).toBeNull();
  });

  it('no forecast yet: no scene, no porthole (the calm empty step)', async () => {
    renderWidget();
    expect(await screen.findByText('Noch kein Ort gewählt.')).toBeTruthy();
    expect(screen.queryByTestId('weather-scene')).toBeNull();
    expect(screen.queryByTestId('scene-porthole')).toBeNull();
  });

  it('the overview keeps its tone-step frame: the scene CSS lives in the weather module, not in Home.module.css', () => {
    const home = readFileSync(resolve(__dirname, '../../../home/Home.module.css'), 'utf8');
    expect(home).not.toMatch(/scene|ink-light|ink-dark/);
    const own = readFileSync(resolve(__dirname, '../routes/weather.module.css'), 'utf8');
    // B: the card's radius, the card's whole box, the opaque chip in the theme's ink
    expect(own).toMatch(
      /\.widgetBackdrop\s*\{[^}]*inset:\s*0[^}]*border-radius:\s*var\(--radius-lg\)/s,
    );
    expect(own).toMatch(/\.widgetRain\s*\{[^}]*color:\s*var\(--ink-theme\)/s);
  });
});
