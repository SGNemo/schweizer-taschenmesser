// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, logLines } from '@/core/diagnostics/errorLog';
import { page } from '@/core/net/OnlineChunk';
import type { ModuleManifest } from '@/core/modules/types';
import { clearAllFormDrafts, FORM_DRAFT_TTL_MS, hasDrafts, useFormDraft } from '@/ui/useFormDraft';
import { ModulePageFallback } from './AreaFrame';
import { PageFallback } from './PageContainer';
import { isLoadError, PAGE_SLOW_MS, PAGE_STUCK_MS, PageLoadingCard } from './PageLoadingCard';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  clearAllFormDrafts();
  clearErrorLog();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const typeDraft = () => {
  const { result } = renderHook(() => useFormDraft('todo-new', { title: '' }));
  act(() => result.current.set('title', 'Milch'));
};

describe('PageFallback with a delay', () => {
  it('shows "…" first and the card with "Neu laden" after 4 s', () => {
    render(<PageFallback delay={PAGE_SLOW_MS} />);
    expect(screen.getByRole('status')).toHaveTextContent('…');
    act(() => void vi.advanceTimersByTime(PAGE_SLOW_MS - 1));
    expect(screen.queryByTestId('page-loading-card')).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('Die Seite lädt noch.');
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('stays "…" without a delay (setup, core pages)', () => {
    render(<PageFallback />);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status')).toHaveTextContent('…');
  });
});

describe('PageLoadingCard', () => {
  it('reloads the page on "Neu laden" while online', () => {
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    render(<PageLoadingCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload offline: it says so and tries in place when the device is back online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    const inPlace = vi.fn();
    render(<PageLoadingCard onRetryInPlace={inPlace} />);
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('wieder online');
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(reload).not.toHaveBeenCalled();
    expect(inPlace).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(inPlace).toHaveBeenCalledTimes(2);
  });

  it('offers no button offline when nothing can be tried in place: the text is the next step', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PageLoadingCard />);
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('wieder online');
    expect(screen.queryByRole('button')).toBeNull();
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('warns about unsaved input only while a form draft is alive', () => {
    const first = render(<PageLoadingCard />);
    expect(screen.queryByText('Ungespeicherte Eingaben gehen verloren.')).toBeNull();
    first.unmount();
    typeDraft();
    render(<PageLoadingCard />);
    expect(screen.getByText('Ungespeicherte Eingaben gehen verloren.')).toBeInTheDocument();
  });
});

describe('hasDrafts', () => {
  it('counts a fresh draft and not an expired one', () => {
    expect(hasDrafts()).toBe(false);
    typeDraft();
    expect(hasDrafts()).toBe(true);
    vi.advanceTimersByTime(FORM_DRAFT_TTL_MS + 1);
    expect(hasDrafts()).toBe(false);
  });
});

describe('ModulePageFallback', () => {
  const manifest = { id: 'todos', name: 'Aufgaben' } as ModuleManifest;

  it('notes a page that is still loading after 15 s: module id only', () => {
    render(<ModulePageFallback manifest={manifest} />);
    act(() => void vi.advanceTimersByTime(PAGE_STUCK_MS - 1));
    expect(logLines()).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(1));
    const line = logLines().at(-1)!;
    expect(line).toMatchObject({ level: 'warn', source: 'module-todos' });
    expect(line.message).toBe('page still loading after 15 s');
    expect(`${line.source} ${line.message}`).not.toMatch(/[/?=]|http/);
  });

  it('notes nothing when the page arrived in time', () => {
    const view = render(<ModulePageFallback manifest={manifest} />);
    act(() => void vi.advanceTimersByTime(PAGE_STUCK_MS - 1));
    view.unmount();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(logLines()).toHaveLength(0);
  });
});

describe('isLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/X.js'),
    new TypeError('error loading dynamically imported module'),
    new TypeError('Importing a module script failed.'),
    new Error('Unable to preload CSS for /assets/X.css'),
  ])('%s is a load error', (error) => {
    expect(isLoadError(error)).toBe(true);
  });

  it('a render error is not', () => {
    expect(isLoadError(new Error('kaputt'))).toBe(false);
    expect(isLoadError('text')).toBe(false);
  });
});
