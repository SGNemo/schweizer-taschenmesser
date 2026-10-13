// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useOpenParam } from './useOpenParam';

function Probe({
  load,
  onOpen,
}: {
  load: (id: string) => Promise<{ id: string } | undefined>;
  onOpen: (r: { id: string }) => void | Record<string, string>;
}) {
  useOpenParam(load, onOpen);
  const loc = useLocation();
  return <output data-testid="search">{loc.search}</output>;
}

const at = (
  search: string,
  load: Parameters<typeof Probe>[0]['load'],
  onOpen: Parameters<typeof Probe>[0]['onOpen'] = vi.fn(),
) =>
  render(
    <MemoryRouter initialEntries={[`/x${search}`]}>
      <Probe load={load} onOpen={onOpen} />
    </MemoryRouter>,
  );

describe('useOpenParam', () => {
  it('opens the record once and removes the parameter', async () => {
    const onOpen = vi.fn();
    at('?open=a1&tab=x', async (id) => ({ id }), onOpen);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'a1' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?tab=x'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('drops an id that no longer exists without opening anything', async () => {
    const onOpen = vi.fn();
    at('?open=gone', async () => undefined, onOpen);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('survives a failing load', async () => {
    const onOpen = vi.fn();
    at('?open=x', () => Promise.reject(new Error('db closed')), onOpen);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('lets a page that shows records through its URL set parameters instead', async () => {
    at(
      '?open=p1',
      async (id) => ({ id }),
      (r) => ({ person: r.id }),
    );
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?person=p1'));
  });

  it('does nothing without the parameter', () => {
    const load = vi.fn();
    at('?tab=x', load);
    expect(load).not.toHaveBeenCalled();
  });
});
