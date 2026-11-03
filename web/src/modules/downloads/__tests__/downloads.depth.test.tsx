// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArrowBand } from '../components/ArrowBand';
import { bandSummary, etaSeconds, formatEta, matchesFilter } from '../lib/format';

const j = (over: Partial<Parameters<typeof bandSummary>[0][number]> = {}) => ({
  state: 'running',
  done: 50,
  total: 100,
  speedBps: 10,
  ...over,
});

describe('band summary', () => {
  it('counts what runs, shares what is done of everything with a known size, adds the speeds', () => {
    const s = bandSummary([
      j({ done: 50, total: 100, speedBps: 10 }),
      j({ state: 'paused', done: 0, total: 100, speedBps: 0 }),
      j({ state: 'done', done: 100, total: 100, speedBps: 0 }),
      j({ done: 5, total: null, speedBps: 5 }),
    ]);
    expect(s).toEqual({ running: 2, percent: 25, speedBps: 15 });
  });

  it('is calm when nothing runs', () => {
    expect(bandSummary([])).toEqual({ running: 0, percent: 0, speedBps: 0 });
    expect(bandSummary([j({ state: 'done' })]).running).toBe(0);
  });
});

describe('filters and remaining time', () => {
  it('splits active, done and problems; all shows everything', () => {
    expect(matchesFilter('running', 'active')).toBe(true);
    expect(matchesFilter('paused', 'active')).toBe(true);
    expect(matchesFilter('done', 'active')).toBe(false);
    expect(matchesFilter('done', 'done')).toBe(true);
    expect(matchesFilter('failed', 'problems')).toBe(true);
    expect(matchesFilter('failed', 'done')).toBe(false);
    expect(matchesFilter('failed', 'all')).toBe(true);
  });

  it('knows the remaining time only for a running job with speed and size', () => {
    expect(etaSeconds({ state: 'running', done: 40, total: 100, speedBps: 2 })).toBe(30);
    expect(etaSeconds({ state: 'paused', done: 40, total: 100, speedBps: 2 })).toBeNull();
    expect(etaSeconds({ state: 'running', done: 40, total: null, speedBps: 2 })).toBeNull();
    expect(etaSeconds({ state: 'running', done: 40, total: 100, speedBps: 0 })).toBeNull();
  });

  it('writes seconds, minutes and hours with minutes', () => {
    expect(formatEta(30)).toMatch(/30/);
    expect(formatEta(120)).toMatch(/2/);
    expect(formatEta(3600 + 300)).toMatch(/1.*5/);
  });
});

describe('ArrowBand (signature)', () => {
  it('shows the figure and its context as text; the band itself is decoration', () => {
    render(<ArrowBand figure="2 laufen" context="64 % · mit 3 MB/s" percent={64} />);
    const band = screen.getByTestId('arrow-band');
    expect(band).toHaveTextContent('2 laufen');
    expect(band).toHaveTextContent('64 %');
    const track = band.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(track).not.toBeNull();
    expect((track.firstElementChild as HTMLElement).style.transform).toBe('scaleX(0.64)');
  });

  it('keeps the fill inside the band', () => {
    render(<ArrowBand figure="x" context="y" percent={180} />);
    const fill = screen
      .getByTestId('arrow-band')
      .querySelector('[aria-hidden] > span') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(1)');
  });
});

describe('no torrent search', () => {
  it('the module has no search field, no search address and never fetches a site itself', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/__tests__/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    for (const [file, code] of Object.entries(sources)) {
      expect(code, file).not.toMatch(/type=["']search["']|role=["']search["']/);
      expect(code, file).not.toMatch(/core\/net\/fetchPublic|searchEngine|torrentSearch/i);
    }
  });
});
