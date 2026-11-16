// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FolderTabs } from '@/ui/FolderTabs';
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

  it('keeps the field while it has the focus, also when a returning search is cleared', async () => {
    const { rerender } = render(<PageList {...props({ query: 'gurken' })} />);
    const box = screen.getByRole('searchbox');
    await userEvent.click(box);
    rerender(<PageList {...props({ query: '' })} />);
    expect(screen.getByRole('searchbox')).toHaveFocus();
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

describe('PageList notebook tabs', () => {
  const book = {
    id: 'nb1',
    name: 'Arbeit',
    tone: 1,
    icon: 'note',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'd',
  } as unknown as PageListProps['books'][number];

  it('shows each count as the tab count (0 included), not inside the name, on one scrolling line', () => {
    render(<PageList {...props({ books: [book] })} />);
    const group = screen.getByRole('group', { name: 'Notizbücher' });
    expect(group).not.toHaveTextContent('·');
    expect(screen.getByRole('button', { name: /^Arbeit\s*0$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Allgemein\s*0$/ })).toBeInTheDocument();
    const { container } = render(
      <FolderTabs label="x" tabs={[]} value="" onChange={() => undefined} nowrap />,
    );
    const nowrapRow = (container.querySelector('[role="group"] > div') as HTMLElement).className;
    expect((group.firstElementChild as HTMLElement).className).toBe(nowrapRow);
  });
});
