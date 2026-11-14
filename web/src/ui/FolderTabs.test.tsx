// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FolderTabs } from './FolderTabs';

const tabs = [
  { id: 'all', label: 'Alle', count: 5 },
  { id: 'a', label: 'Ausweise', count: 0 },
  { id: 'b', label: 'Verträge', count: 2, color: 'rgb(10, 20, 30)' },
];

describe('FolderTabs', () => {
  it('is a named group of buttons, the chosen one has aria-pressed', () => {
    render(<FolderTabs label="Kategorie" tabs={tabs} value="a" onChange={() => undefined} />);
    const group = screen.getByRole('group', { name: 'Kategorie' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ausweise/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Alle/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a given count next to the label, 0 included, and none when it is left out (U53)', () => {
    render(
      <FolderTabs
        label="Kategorie"
        tabs={[...tabs, { id: 'c', label: 'Sonstiges' }]}
        value="all"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /Alle\s*5/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ausweise\s*0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sonstiges' })).toBeInTheDocument();
  });

  it('keeps the tabs on one scrolling line with `nowrap` (U22)', () => {
    const { container, rerender } = render(
      <FolderTabs label="Kategorie" tabs={tabs} value="all" onChange={() => undefined} />,
    );
    const row = () => container.querySelector('[role="group"] > div') as HTMLElement;
    const plain = row().className;
    rerender(
      <FolderTabs label="Kategorie" tabs={tabs} value="all" onChange={() => undefined} nowrap />,
    );
    expect(row().className).not.toBe(plain);
    expect(row().className).toContain(plain);
  });

  it('reports the clicked tab and renders extra controls at the end of the row', async () => {
    const onChange = vi.fn();
    render(
      <FolderTabs label="Kategorie" tabs={tabs} value="all" onChange={onChange} folder testId="t">
        <button type="button">Neu</button>
      </FolderTabs>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Verträge/ }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button', { name: 'Neu' })).toBeInTheDocument();
    expect(screen.getByTestId('t')).toBeInTheDocument();
  });

  it('gives a tab its own colour through the --tab variable and marks it as tinted', () => {
    render(<FolderTabs label="Kategorie" tabs={tabs} value="all" onChange={() => undefined} />);
    const own = screen.getByRole('button', { name: /Verträge/ });
    expect(own.style.getPropertyValue('--tab')).toBe('rgb(10, 20, 30)');
    expect(own).toHaveAttribute('data-tinted');
    expect(screen.getByRole('button', { name: /Alle/ })).not.toHaveAttribute('data-tinted');
  });
});
