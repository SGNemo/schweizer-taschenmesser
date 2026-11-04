// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCROLLING_MS, watchScrolling } from './scrollbars';

describe('scrollbars (identity v3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks the element that scrolls and clears the mark after a moment', () => {
    const stop = watchScrolling();
    const box = document.createElement('div');
    document.body.append(box);
    box.dispatchEvent(new Event('scroll'));
    expect(box).toHaveAttribute('data-scrolling', 'true');
    vi.advanceTimersByTime(SCROLLING_MS - 1);
    expect(box).toHaveAttribute('data-scrolling', 'true');
    vi.advanceTimersByTime(2);
    expect(box).not.toHaveAttribute('data-scrolling');
    stop();
  });

  it('keeps the mark while the scrolling goes on, and marks the page for a document scroll', () => {
    const stop = watchScrolling();
    const box = document.createElement('div');
    document.body.append(box);
    box.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);
    box.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);
    expect(box).toHaveAttribute('data-scrolling', 'true');
    document.dispatchEvent(new Event('scroll'));
    expect(document.documentElement).toHaveAttribute('data-scrolling', 'true');
    stop();
    expect(box).not.toHaveAttribute('data-scrolling');
    expect(document.documentElement).not.toHaveAttribute('data-scrolling');
  });

  it('the global stylesheet makes every scrollbar thin and transparent until hover or scrolling', () => {
    const css = readFileSync(resolve(__dirname, '../../ui/global.css'), 'utf8');
    expect(css).toMatch(/scrollbar-width:\s*thin/);
    expect(css).toMatch(/scrollbar-color:\s*transparent transparent/);
    expect(css).toMatch(/:hover\s*\{[^}]*scrollbar-color:\s*var\(--scroll-thumb\)/);
    expect(css).toMatch(
      /\[data-scrolling='true'\]\s*\{[^}]*scrollbar-color:\s*var\(--scroll-thumb\)/,
    );
  });
});
