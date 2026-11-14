// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import misc from '@/ui/Misc.module.css';
import {
  gridColumns,
  packedRows,
  SETTLE_CAP_MS,
  stagedCards,
  stillLoading,
  usePackedGrid,
} from './masonry';

describe('packed overview grid (U19)', () => {
  it('spans a card over its own height plus the gap below, in 1 px rows', () => {
    expect(packedRows(200, 24)).toBe(224);
    expect(packedRows(312.4, 24)).toBe(337);
    expect(packedRows(0, 0)).toBe(1);
  });
});

describe('build-up helpers', () => {
  const card = (loading: boolean) => {
    const el = document.createElement('div');
    if (loading) el.innerHTML = '<span class="sk"></span>';
    return el;
  };
  it('a step is loading while one of its cards shows a skeleton', () => {
    expect(stillLoading([card(false), card(true)], '.sk')).toBe(true);
    expect(stillLoading([card(false), card(false)], '.sk')).toBe(false);
    expect(stillLoading([], '.sk')).toBe(false);
  });
  it('counts the grid columns, at least one', () => {
    const grid = document.body.appendChild(document.createElement('div'));
    grid.style.gridTemplateColumns = '100px 100px 100px';
    expect(gridColumns(grid)).toBe(3);
    grid.remove();
    expect(gridColumns(document.createElement('div'))).toBe(1);
  });
  it('mounts the first step only while a second one holds more than one more row', () => {
    const cards = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(stagedCards(cards, 3, false)).toEqual(['a', 'b', 'c']);
    // Column count not read yet: nothing yet.
    expect(stagedCards(cards, 0, false)).toEqual([]);
    // Few cards ("Ruhig"): one step.
    expect(stagedCards(cards.slice(0, 6), 3, false)).toEqual(cards.slice(0, 6));
    // Built (or the edit mode was open): everything, never staged again.
    expect(stagedCards(cards, 3, true)).toEqual(cards);
  });
  it('has a cap, so a card that never loads cannot hide the others', () => {
    expect(SETTLE_CAP_MS).toBeGreaterThan(0);
    expect(SETTLE_CAP_MS).toBeLessThanOrEqual(2000);
  });
});

describe('build-up: cards of a step show together, once', () => {
  const skeleton = `<span class="${misc.skeleton}"></span>`;
  function Grid(props: {
    keys: string[];
    loading: string[];
    ready?: boolean;
    onShown?: () => void;
    holdNew?: boolean;
  }): ReactNode {
    const ref = usePackedGrid<HTMLDivElement>(
      props.keys.join('|'),
      true,
      props.ready ?? true,
      props.onShown,
      props.holdNew ?? true,
    );
    return createElement(
      'div',
      { ref, 'data-testid': 'grid' },
      props.keys.map((k) =>
        createElement('div', {
          key: k,
          'data-k': k,
          dangerouslySetInnerHTML: { __html: props.loading.includes(k) ? skeleton : k },
        }),
      ),
    );
  }
  const waits = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('[data-k]'))
      .filter((el) => el.hasAttribute('data-wait'))
      .map((el) => el.getAttribute('data-k'));
  // The mutation observer answers in a microtask, the frame after it is a timer here.
  const frame = () =>
    act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds every card of the step until the last one has its content, then shows them in one go', async () => {
    const onShown = vi.fn();
    const { getByTestId, rerender } = render(
      createElement(Grid, { keys: ['a', 'b'], loading: ['b'], onShown }),
    );
    const grid = getByTestId('grid');
    expect(waits(grid)).toEqual(['a', 'b']);
    expect(grid.getAttribute('aria-busy')).toBe('true');
    rerender(createElement(Grid, { keys: ['a', 'b'], loading: [], onShown }));
    await frame();
    expect(waits(grid)).toEqual([]);
    expect(grid.hasAttribute('data-settling')).toBe(false);
    expect(grid.hasAttribute('aria-busy')).toBe(false);
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('waits for the page (ready) before a step may show', async () => {
    const { getByTestId, rerender } = render(
      createElement(Grid, { keys: ['a'], loading: [], ready: false }),
    );
    expect(waits(getByTestId('grid'))).toEqual(['a']);
    rerender(createElement(Grid, { keys: ['a'], loading: [], ready: true }));
    expect(waits(getByTestId('grid'))).toEqual([]);
  });

  it('a later step waits on its own; cards already shown never wait again', async () => {
    const { getByTestId, rerender } = render(createElement(Grid, { keys: ['a'], loading: [] }));
    const grid = getByTestId('grid');
    expect(waits(grid)).toEqual([]);
    rerender(createElement(Grid, { keys: ['a', 'b', 'c'], loading: ['c'] }));
    expect(waits(grid)).toEqual(['b', 'c']);
    // Only the first step is announced as busy.
    expect(grid.hasAttribute('aria-busy')).toBe(false);
    rerender(createElement(Grid, { keys: ['a', 'b', 'c'], loading: [] }));
    await frame();
    expect(waits(grid)).toEqual([]);
  });

  it('shows a step at the cap even if a card never loads, counted from when it could start', () => {
    const { getByTestId } = render(createElement(Grid, { keys: ['a', 'b'], loading: ['b'] }));
    act(() => vi.advanceTimersByTime(SETTLE_CAP_MS - 10));
    expect(waits(getByTestId('grid'))).toEqual(['a', 'b']);
    act(() => vi.advanceTimersByTime(20));
    expect(waits(getByTestId('grid'))).toEqual([]);
  });

  it('once built, a card that mounts later (another view) shows at once', () => {
    const { getByTestId, rerender } = render(
      createElement(Grid, { keys: ['a'], loading: [], holdNew: false }),
    );
    rerender(createElement(Grid, { keys: ['a', 'b'], loading: ['b'], holdNew: false }));
    expect(waits(getByTestId('grid'))).toEqual([]);
  });
});
