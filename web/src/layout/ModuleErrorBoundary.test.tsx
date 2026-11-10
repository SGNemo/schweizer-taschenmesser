// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, errorLog } from '@/core/diagnostics/errorLog';
import { page } from '@/core/net/OnlineChunk';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';

const openUrl = vi.fn((_url: string) => Promise.resolve());
vi.mock('@/core/platform', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getPlatform: () => ({
    kind: 'web',
    app: { openUrl, version: async () => '0.0.0' },
    desktop: { info: async () => ({ portable: false }) },
  }),
}));

let broken = true;
function Bomb() {
  if (broken) throw new Error('kaputt');
  return <p>alles gut</p>;
}

afterEach(() => {
  broken = true;
  clearErrorLog();
  openUrl.mockClear();
  vi.restoreAllMocks();
});

const renderIt = () =>
  render(
    <MemoryRouter>
      <ModuleErrorBoundary manifest={{ id: 'todos', name: 'Aufgaben' }}>
        <Bomb />
      </ModuleErrorBoundary>
      <p>Rest der App</p>
    </MemoryRouter>,
  );

describe('ModuleErrorBoundary', () => {
  it('shows a card, keeps the rest of the app and logs the error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt();
    expect(screen.getByRole('alert')).toHaveTextContent('Aufgaben');
    expect(screen.getByText('Rest der App')).toBeInTheDocument();
    expect(errorLog().at(-1)?.source).toBe('module-todos');
  });

  it('retries with a reload while online (a failed lazy page stays failed in place)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('retries in place while offline and recovers when the cause is gone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    renderIt();
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('alles gut')).toBeInTheDocument();
  });

  it('shows the loading card, not the error card, when the page code did not load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
    function Missing(): never {
      throw new TypeError(
        'Failed to fetch dynamically imported module: http://localhost/assets/X.js',
      );
    }
    render(
      <MemoryRouter>
        <ModuleErrorBoundary manifest={{ id: 'todos', name: 'Aufgaben' }}>
          <Missing />
        </ModuleErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('page-loading-card')).toHaveTextContent('Die Seite lädt noch.');
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('opens the prefilled report in the browser on click only', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt();
    expect(openUrl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fehler melden' }));
    await vi.waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));
    expect(String(openUrl.mock.calls[0]![0])).toContain('issues/new');
  });
});
