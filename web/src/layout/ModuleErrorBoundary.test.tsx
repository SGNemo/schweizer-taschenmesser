// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, errorLog } from '@/core/diagnostics/errorLog';
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

  it('retries and recovers when the cause is gone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt();
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(screen.getByText('alles gut')).toBeInTheDocument();
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
