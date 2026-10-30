// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HourRow } from '@/core/weather/api';
import { WeatherChart } from './WeatherChart';

const hour = (i: number): HourRow => ({
  time: `2026-10-29T${String(i).padStart(2, '0')}:00`,
  temp: 10 + (i % 5),
  group: 'partly',
  rain: 0,
});
const hours = Array.from({ length: 24 }, (_, i) => hour(i));

/** A stand-in for the browser's ResizeObserver: records the observed elements and lets a test fire. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
  fire(width: number) {
    this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('WeatherChart width', () => {
  it('follows the element even when the chart appears only after a later fetch', () => {
    const { rerender } = render(<WeatherChart hours={hours.slice(0, 1)} />);
    expect(screen.queryByTestId('weather-chart')).toBeNull();
    expect(FakeResizeObserver.instances.flatMap((o) => o.observed)).toHaveLength(0);

    rerender(<WeatherChart hours={hours} />);
    const chart = screen.getByTestId('weather-chart');
    const observers = FakeResizeObserver.instances.filter((o) => o.observed.includes(chart));
    expect(observers).toHaveLength(1);

    act(() => observers[0]!.fire(300));
    expect(chart.querySelector('svg')).toHaveAttribute('width', '300');
  });

  it('stops observing when the chart goes away', () => {
    const { unmount } = render(<WeatherChart hours={hours} />);
    const chart = screen.getByTestId('weather-chart');
    const observer = FakeResizeObserver.instances.find((o) => o.observed.includes(chart))!;
    unmount();
    expect(observer.observed).toHaveLength(0);
  });
});
