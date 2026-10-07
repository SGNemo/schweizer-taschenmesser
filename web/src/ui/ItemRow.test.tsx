// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, EmptyState, ErrorState, SkeletonRows } from './Misc';
import { ItemList, ItemRow } from './Patterns';

describe('ItemRow', () => {
  it('is a list item with a main button named by title and meta', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <ItemList label="Rechnungen">
        <ItemRow title="Stadtwerke" meta="Fällig am 1. Okt." onOpen={onOpen} end={<b>87,40 €</b>} />
      </ItemList>,
    );
    const list = screen.getByRole('list', { name: 'Rechnungen' });
    const row = within(list).getByRole('listitem');
    await user.click(within(row).getByRole('button', { name: /Stadtwerke.*Fällig am 1\. Okt\./ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(within(row).getByText('87,40 €')).toBeVisible();
  });

  it('marks the main element for keyboard navigation and shows actions as buttons', () => {
    render(
      <ItemList>
        <ItemRow
          title="A"
          onOpen={() => undefined}
          actions={<button type="button">Löschen</button>}
        />
      </ItemList>,
    );
    expect(document.querySelector('[data-row]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
  });

  it('a selectable row reports clicks with the Shift state for ranges', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ItemList>
        <ItemRow title="A" selectable selected={false} onSelectChange={onSelect} />
      </ItemList>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Auswählen' }));
    expect(onSelect).toHaveBeenLastCalledWith(true, false);
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('checkbox', { name: 'Auswählen' }));
    expect(onSelect).toHaveBeenLastCalledWith(true, true);
  });

  it('a done row stays readable (class applied, text kept)', () => {
    render(
      <ItemList>
        <ItemRow title="Erledigt" done />
      </ItemList>,
    );
    expect(screen.getByRole('listitem').className).toMatch(/done/);
    expect(screen.getByText('Erledigt')).toBeVisible();
  });
});

describe('states and badges', () => {
  it('empty state: one sentence and at most the given button', () => {
    render(
      <EmptyState title="Noch nichts da.">
        <button type="button">Anlegen</button>
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'Noch nichts da.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeVisible();
  });

  it('error state offers a retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState title="Das hat nicht geklappt." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Das hat nicht geklappt.');
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('skeleton rows announce loading without text noise', () => {
    render(<SkeletonRows count={3} />);
    expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeInTheDocument();
  });

  it('badge has an info tone', () => {
    render(<Badge tone="info">Beta</Badge>);
    expect(screen.getByText('Beta').className).toMatch(/info/);
  });
});
