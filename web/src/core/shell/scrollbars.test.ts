// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCROLLING_MS, watchScrollbarWidth, watchScrolling } from './scrollbars';

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

describe('scrollbar width (0b-R: the right edge with a classic scrollbar)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('puts the measured width on the root, measures again on resize and cleans up', () => {
    let width = 11;
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => 100);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 100 - width);
    const root = document.documentElement;
    const before = document.body.children.length;
    const stop = watchScrollbarWidth();
    expect(root.style.getPropertyValue('--scrollbar-w')).toBe('11px');
    // A browser zoom changes the width in CSS pixels.
    width = 9;
    window.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--scrollbar-w')).toBe('9px');
    // Overlay scrollbars take no room.
    width = 0;
    window.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--scrollbar-w')).toBe('0px');
    // The probe never stays in the page.
    expect(document.body.children).toHaveLength(before);
    stop();
    expect(root.style.getPropertyValue('--scrollbar-w')).toBe('');
  });

  it('the desktop content area keeps the gutter and takes it off its right padding', () => {
    const shell = readFileSync(resolve(__dirname, '../../layout/AppShell.module.css'), 'utf8');
    expect(shell).toMatch(/scrollbar-gutter:\s*stable/);
    expect(shell).toMatch(
      /--frame-bleed-end:\s*max\(0px, calc\(var\(--page-gutter\) - var\(--scrollbar-w, 0px\)\)\)/,
    );
    expect(shell).toMatch(/padding-right:\s*var\(--frame-bleed-end\)/);
  });
});
