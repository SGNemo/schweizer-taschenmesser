// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageList, type PageListProps } from '../components/PageList';

const props = (over: Partial<PageListProps> = {}): PageListProps => ({
  pages: [],
  books: [],
  filter: 'all',
  onFilter: vi.fn(),
  sort: 'recent',
  onSort: vi.fn(),
  query: '',
  onQuery: vi.fn(),
  activeId: null,
  openIds: [],
  showOpenList: false,
  onOpen: vi.fn(),
  onCloseTab: vi.fn(),
  onNewPage: vi.fn(),
  onNewFromTemplate: vi.fn(),
  view: 'list',
  onView: vi.fn(),
  onNewNotebook: vi.fn(),
  onEditNotebook: vi.fn(),
  onTogglePin: vi.fn(),
  onMove: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
  onOpenTrash: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  ...over,
});

describe('PageList controls (U22: fewer rows before the first note)', () => {
  it('keeps the search behind an icon until it is opened, then focuses the field', async () => {
    render(<PageList {...props()} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Notizen durchsuchen' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('shows the field right away while a search is active', () => {
    render(<PageList {...props({ query: 'gurken' })} />);
    expect(screen.getByRole('searchbox')).toHaveValue('gurken');
  });

  it('sorts from the ⋯ menu instead of an own select row', async () => {
    const onSort = vi.fn();
    render(<PageList {...props({ onSort })} />);
    expect(screen.queryByRole('combobox', { name: 'Sortierung' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Vorlagen und Sortierung' }));
    expect(screen.getByRole('menuitemcheckbox', { name: /Zuletzt geändert/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Titel/ }));
    expect(onSort).toHaveBeenCalledWith('title');
  });
});
