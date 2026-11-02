// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import type { DisplayService } from '@/core/platform/types';
import { useUiStore } from '@/stores/ui';
import { CockpitBar } from './CockpitBar';
import { CockpitPanel } from './CockpitPanel';
import { enterCockpit, exitCockpit, useCockpit } from './useCockpit';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function fakeDisplay(over: Partial<DisplayService> = {}): DisplayService & { calls: string[] } {
  const calls: string[] = [];
  let full = false;
  return {
    calls,
    fullscreenSupported: true,
    async setFullscreen(on) {
      full = on;
      calls.push(`fullscreen:${on}`);
    },
    isFullscreen: async () => full,
    async setImmersive(on) {
      calls.push(`immersive:${on}`);
    },
    async setKeepAwake(on) {
      calls.push(`awake:${on}`);
    },
    ...over,
  };
}

let display = fakeDisplay();

beforeEach(() => {
  localStorage.clear();
  display = fakeDisplay();
  setPlatform({ ...getPlatform(), display });
  useUiStore.setState({ cockpit: false, cockpitAwake: false, homeEditing: false });
});
afterEach(() => {
  setPlatform(undefined);
  useUiStore.getState().setCockpit(false);
  useUiStore.getState().setHomeEditing(false);
});

function Host({ start = '/' }: { start?: string }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <Where />
      <Shell />
    </MemoryRouter>
  );
}
function Shell() {
  useCockpit();
  const cockpit = useUiStore((s) => s.cockpit);
  const { pathname } = useLocation();
  return (
    <>
      {cockpit ? <CockpitBar /> : null}
      <CockpitPanel open={cockpit && pathname !== '/'}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/finance" element={<p>Finanzen-Seite</p>} />
        </Routes>
      </CockpitPanel>
    </>
  );
}

describe('cockpit mode', () => {
  it('enter goes to the overview and remembers the state; exit forgets it', () => {
    const navigate = vi.fn();
    enterCockpit(navigate, '/finance');
    expect(navigate).toHaveBeenCalledWith('/');
    expect(useUiStore.getState().cockpit).toBe(true);
    expect(localStorage.getItem('tm-cockpit')).toBe('1');
    exitCockpit();
    expect(useUiStore.getState().cockpit).toBe(false);
    expect(localStorage.getItem('tm-cockpit')).toBeNull();
  });

  it('asks Android for immersive mode while on, and keep-awake only when wanted', async () => {
    useUiStore.setState({ cockpitAwake: true });
    render(<Host />);
    expect(display.calls).toEqual(['immersive:false', 'awake:false']);
    act(() => useUiStore.getState().setCockpit(true));
    await act(async () => {});
    expect(display.calls.slice(-2)).toEqual(['immersive:true', 'awake:true']);
    act(() => useUiStore.getState().setCockpit(false));
    expect(display.calls.slice(-2)).toEqual(['immersive:false', 'awake:false']);
  });

  it('shows a module in the panel; Esc closes the panel first, then the cockpit', async () => {
    useUiStore.setState({ cockpit: true });
    render(<Host start="/finance" />);
    expect(screen.getByTestId('cockpit-panel')).toBeInTheDocument();
    expect(screen.getByText('Finanzen-Seite')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    expect(screen.queryByTestId('cockpit-panel')).not.toBeInTheDocument();
    expect(useUiStore.getState().cockpit).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().cockpit).toBe(false);
  });

  it('Esc leaves an open dialog and a text field alone', () => {
    useUiStore.setState({ cockpit: true });
    render(
      <>
        <Host />
        <dialog open>offen</dialog>
      </>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().cockpit).toBe(true);
  });

  it('F11 toggles real full screen through the platform', async () => {
    useUiStore.setState({ cockpit: true });
    render(<Host />);
    fireEvent.keyDown(window, { key: 'F11' });
    await act(async () => {});
    expect(display.calls).toContain('fullscreen:true');
    // Leaving the cockpit hands the full screen back.
    exitCockpit();
    await act(async () => {});
    expect(display.calls.filter((c) => c.startsWith('fullscreen'))).toEqual([
      'fullscreen:true',
      'fullscreen:false',
    ]);
  });

  it('the mini bar opens from its grip and from the top edge; its buttons reach search, capture and exit', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ cockpit: true });
    render(<Host />);
    const bar = screen.getByTestId('cockpit-bar');
    expect(bar).not.toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', { name: 'Leiste anzeigen' }));
    expect(bar).toHaveAttribute('data-open', 'true');
    await user.click(screen.getByRole('button', { name: /Suchen/ }));
    expect(useUiStore.getState().paletteOpen).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Neu: schnell hinzufügen' }));
    expect(useUiStore.getState().quickAddOpen).toBe(true);
    await user.click(screen.getByTestId('cockpit-exit'));
    expect(useUiStore.getState().cockpit).toBe(false);
  });

  it("the panel's back button returns to the overview", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ cockpit: true });
    render(<Host start="/finance" />);
    await user.click(screen.getByTestId('cockpit-panel-close'));
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });
});
