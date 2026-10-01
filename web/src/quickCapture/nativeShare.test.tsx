// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
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
});
