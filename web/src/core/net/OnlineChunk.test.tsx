// @vitest-environment jsdom
import { Component, Suspense, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkUnavailable, lazyOnline, page } from './OnlineChunk';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Part = ({ word }: { word: string }) => <p>{word}</p>;
const ok = () => Promise.resolve({ default: Part });
const offline = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

class Outer extends Component<{ children: ReactNode }, { error?: unknown }> {
  override state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    return this.state.error ? (
      <p>outer: {String(this.state.error)}</p>
    ) : (
      <Suspense fallback={<p>…</p>}>{this.props.children}</Suspense>
    );
  }
}

describe('lazyOnline', () => {
  it('renders the part once it loaded', async () => {
    const Cmp = lazyOnline(ok);
    render(
      <Outer>
        <Cmp word="geladen" />
      </Outer>,
    );
    expect(await screen.findByText('geladen')).toBeTruthy();
  });

  it('a failed import shows the calm notice, not an error; "Erneut versuchen" (offline) retries in place', async () => {
    const load = vi.fn<typeof ok>().mockImplementationOnce(offline).mockImplementation(ok);
    const Cmp = lazyOnline(load);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(
      <Outer>
        <Cmp word="geladen" />
      </Outer>,
    );
    const notice = await screen.findByTestId('online-chunk');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toMatch(/lädt beim ersten Öffnen aus dem Netz/);
    expect(screen.queryByText(/outer:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('geladen')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('retries by itself when the device is back online', async () => {
    const load = vi.fn<typeof ok>().mockImplementationOnce(offline).mockImplementation(ok);
    const Cmp = lazyOnline(load);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Outer>
        <Cmp word="wieder da" />
      </Outer>,
    );
    await screen.findByTestId('online-chunk');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText('wieder da')).toBeTruthy();
  });

  it('failed again after coming back online (the browser remembers): "Erneut versuchen" reloads the page', async () => {
    const Cmp = lazyOnline<{ word: string }>(offline);
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Outer>
        <Cmp word="x" />
      </Outer>,
    );
    await screen.findByTestId('online-chunk');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    // The in-place retry ran (and failed again): the notice is back, nothing reloaded by itself.
    const again = await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(again);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('failed while online (stale page after a deploy): the first "Erneut versuchen" reloads', async () => {
    const load = vi.fn(offline);
    const Cmp = lazyOnline<{ word: string }>(load);
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Outer>
        <Cmp word="x" />
      </Outer>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('an error inside the loaded part still reaches the outer boundary', async () => {
    const Broken = () => {
      throw new Error('kaputt');
    };
    const Cmp = lazyOnline(() => Promise.resolve({ default: Broken }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Outer>
        <Cmp />
      </Outer>,
    );
    expect(await screen.findByText(/outer: Error: kaputt/)).toBeTruthy();
    expect(screen.queryByTestId('online-chunk')).toBeNull();
  });

  it('ChunkUnavailable keeps the cause', () => {
    const cause = new TypeError('x');
    expect(new ChunkUnavailable(cause).cause).toBe(cause);
  });
});
