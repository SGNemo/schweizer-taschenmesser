// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { useUiStore } from '@/stores/ui';
import { useNativeShare } from './nativeShare';

function Probe() {
  useNativeShare();
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

afterEach(() => setPlatform(undefined));

describe('useNativeShare', () => {
  it('opens /share with the shared text when the Android plugin has one', async () => {
    const takePending = vi.fn(async () => ({ title: 'Weg', text: 'https://wandern.example/weg' }));
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending } });
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/share?title=Weg&text='),
    );
  });

  it('stays put when nothing was shared or the platform has no share service', async () => {
    const takePending = vi.fn(async () => undefined);
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending } });
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(takePending).toHaveBeenCalled());
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('opens capture, search or Heute for a launcher shortcut or the quick-settings tile', async () => {
    useUiStore.setState({ quickAddOpen: false, paletteOpen: false });
    const capture = vi.fn(async () => ({ title: '', text: '', open: 'capture' as const }));
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending: capture } });
    const first = render(
      <MemoryRouter initialEntries={['/todos']}>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(useUiStore.getState().quickAddOpen).toBe(true));
    expect(screen.getByTestId('where').textContent).toBe('/todos');
    first.unmount();

    const search = vi.fn(async () => ({ title: '', text: '', open: 'search' as const }));
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending: search } });
    const second = render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(useUiStore.getState().paletteOpen).toBe(true));
    second.unmount();

    const today = vi.fn(async () => ({ title: '', text: '', open: 'today' as const }));
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending: today } });
    render(
      <MemoryRouter initialEntries={['/notes']}>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    useUiStore.setState({ quickAddOpen: false, paletteOpen: false });
  });

  it('keeps a waiting share ahead of a shortcut', async () => {
    const both = vi.fn(async () => ({ title: '', text: 'Milch', open: 'today' as const }));
    setPlatform({ ...createWebPlatform(), share: { supported: true, takePending: both } });
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/share?'));
  });
});
