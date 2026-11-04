// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadAidContext } from '@/core/text/ReadableText';
import { setNow } from '@/core/time/now';
import { dayPart } from '@/strings.overview';

const weather = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('@/core/weather/useWeather', () => ({ useWeather: () => weather.value }));

import { OverviewHead } from './OverviewHead';

const at = (hour: number) => setNow(() => new Date(2026, 8, 29, hour, 30).getTime());
const draw = (ui = <OverviewHead />) => render(<MemoryRouter>{ui}</MemoryRouter>);
const sunny = {
  place: 'Bern, Schweiz',
  forecast: { temp: 14, group: 'partly', rainFrom: '15' },
  at: 0,
  stale: false,
};

describe('OverviewHead', () => {
  beforeEach(() => {
    weather.value = undefined;
    at(8);
  });
  afterEach(() => {
    cleanup();
    setNow();
  });

  it('greets by the time of day, calm and without a name', () => {
    expect(dayPart(4)).toBe('night');
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(10)).toBe('morning');
    expect(dayPart(11)).toBe('day');
    expect(dayPart(16)).toBe('day');
    expect(dayPart(17)).toBe('evening');
    expect(dayPart(21)).toBe('evening');
    expect(dayPart(22)).toBe('night');
    const heard = (hour: number) => {
      at(hour);
      const { unmount } = draw();
      const text = screen.getByRole('heading', { level: 1 }).textContent;
      unmount();
      return text;
    };
    expect(heard(8)).toBe('Übersicht: Guten Morgen');
    expect(heard(13)).toBe('Übersicht: Guten Tag');
    expect(heard(19)).toBe('Übersicht: Guten Abend');
    expect(heard(2)).toBe('Übersicht: Hallo');
  });

  it('keeps the page name in the h1 for screen readers while only the greeting shows', () => {
    draw();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Übersicht: Guten Morgen' });
    expect(h1.querySelector('.sr-only')?.textContent).toBe('Übersicht:');
  });

  it('shows the date as a time element', () => {
    draw();
    const date = screen.getByText('Dienstag, 29. September');
    expect(date.tagName).toBe('TIME');
    expect(date.getAttribute('datetime')).toBe('2026-09-29');
  });

  it('adds the weather line only when the weather module is on and a place is chosen', async () => {
    weather.value = sunny;
    draw(<OverviewHead weather />);
    // The line is a lazy chunk (its texts stay off the start path); once loaded it renders at once.
    const link = await screen.findByRole('link', {
      name: 'Wetter: 14° · leicht bewölkt · ab 15 Uhr Regen',
    });
    expect(link.getAttribute('href')).toBe('/weather');
    cleanup();
    draw();
    expect(screen.queryByRole('link', { name: /Wetter/ })).toBeNull();
    cleanup();
    weather.value = undefined;
    draw(<OverviewHead weather />);
    expect(screen.queryByRole('link', { name: /Wetter/ })).toBeNull();
  });

  it('leaves the rain hint out of an old forecast', async () => {
    weather.value = { ...sunny, stale: true };
    draw(<OverviewHead weather />);
    expect(await screen.findByRole('link', { name: 'Wetter: 14° · leicht bewölkt' })).toBeTruthy();
  });

  it('puts the tools in the head and none when there are none', () => {
    draw(<OverviewHead tools={<button type="button">Anpassen</button>} />);
    expect(screen.getByRole('button', { name: 'Anpassen' })).toBeTruthy();
    cleanup();
    const { container } = draw();
    expect(container.querySelector('button')).toBeNull();
  });

  it('reads the same with the reading aid on (it only marks word starts)', async () => {
    weather.value = sunny;
    const { container } = render(
      <MemoryRouter>
        <ReadAidContext.Provider value={{ cover: 100, share: 0.4, blocked: false }}>
          <OverviewHead weather />
        </ReadAidContext.Provider>
      </MemoryRouter>,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Übersicht: Guten Morgen');
    expect(container.querySelector('time')?.textContent).toBe('Dienstag, 29. September');
    expect(screen.getByRole('heading', { level: 1, name: 'Übersicht: Guten Morgen' })).toBeTruthy();
    // The weather link keeps its own label; the marks add no semantics.
    expect(await screen.findByRole('link', { name: /^Wetter: 14°/ })).toBeTruthy();
  });
});
