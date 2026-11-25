// @vitest-environment jsdom
/**
 * `?view=<word>` (planner hub 2, package 2: the pile's „In Rechnungen ansehen“): untrusted, only an allow-listed word
 * reaches the page, read once, then off the URL either way.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useViewParam } from './useViewParam';

function Page({ onView }: { onView: (v: string) => void }) {
  useViewParam(['open'] as const, onView);
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}
const open = (url: string, onView: (v: string) => void) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Page onView={onView} />
    </MemoryRouter>,
  );

describe('useViewParam', () => {
  it('an allowed word reaches the page once and leaves the URL; other parameters stay', async () => {
    const onView = vi.fn();
    open('/invoices?view=open&x=1', onView);
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?x=1'));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith('open');
  });

  it('any other word is ignored and still leaves the URL', async () => {
    const onView = vi.fn();
    open('/invoices?view=%2Fsettings%3Fdelete', onView);
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(onView).not.toHaveBeenCalled();
  });
});
