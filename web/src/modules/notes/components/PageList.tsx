import { useState } from 'react';
import { StartDataButton } from '@/core/importer/StartDataButton';
import type { Stored } from '@/core/db/types';
import { compareText } from '@/core/i18n/format';
import { t } from '@/strings';
import {
  Button,
  categoryColor,
  EmptyState,
  Icon,
  IconButton,
  RowMenu,
  SelectField,
  SortableList,
  TextField,
  type RowMenuItem,
} from '@/ui';
import type { IconName } from '@/ui/icons';
import {
  countByNotebook,
  displayTitle,
  excerpt,
  filterByNotebook,
  isScratch,
  matchSnippet,
  type NotebookFilter,
  orderPatches,
  searchNotes,
  type SortMode,
  sortPages,
  SORT_MODES,
} from '../logic';
import type { Note, Notebook } from '../schema';
import styles from './PageList.module.css';

type Page = Stored<Note>;
type Book = Stored<Notebook>;

export interface PageListProps {
  pages: Page[] | undefined;
  books: Book[];
  filter: NotebookFilter;
  onFilter: (f: NotebookFilter) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  query: string;
  onQuery: (q: string) => void;
  activeId: string | null;
  /** Ids of the open pages (phone: listed on top, desktop: shown as tabs). */
  openIds: string[];
  showOpenList: boolean;
  onOpen: (page: Page) => void;
  onCloseTab: (id: string) => void;
  onNewPage: () => void;
  onNewNotebook: () => void;
  onEditNotebook: (book: Book) => void;
  onTogglePin: (page: Page) => void;
  onMove: (page: Page) => void;
  onDelete: (page: Page) => void;
  onReorder: (patches: { id: string; order: number }[]) => void;
  onOpenTrash: () => void;
}

const titleOf = (n: Page) => (isScratch(n) ? t.notes.scratch : displayTitle(n) || t.notes.untitled);

export function PageList(p: PageListProps) {
  const { pages, books, filter, sort, query } = p;
  const counts = countByNotebook(pages ?? []);
  const bookOf = new Map(books.map((b) => [b.id, b]));
  const shown = sortPages(
    searchNotes(filterByNotebook(pages ?? [], filter), query),
    sort,
    compareText,
  );
  const scratch = shown.find(isScratch);
  const rest = shown.filter((n) => !isScratch(n));
  const total = (pages ?? []).filter((n) => !isScratch(n)).length;
  const manual = sort === 'manual' && !query.trim();
  const openPages = p.openIds
    .map((id) => (pages ?? []).find((n) => n.id === id))
    .filter((n): n is Page => !!n);
  const activeBook = bookOf.get(filter);

  return (
    <nav className={styles.list} aria-label={t.notes.pages}>
      <div className={styles.head}>
        <Button variant="primary" onClick={p.onNewPage} title={t.notes.shortcutNew}>
          <Icon name="plus" size={18} />
          {t.notes.newPage}
        </Button>
      </div>
      <TextField
        label={t.notes.search}
        labelHidden
        placeholder={t.notes.search}
        type="search"
        value={query}
        onChange={(e) => p.onQuery(e.target.value)}
      />

      {p.showOpenList && openPages.length > 0 ? (
        <section aria-label={t.notes.openPages} className={styles.open}>
          <h2 className={styles.heading}>{t.notes.openPages}</h2>
          <ul className={styles.plain}>
            {openPages.map((n) => (
              <li key={n.id} className={styles.openRow}>
                <button
                  type="button"
                  className={styles.main}
                  aria-current={n.id === p.activeId ? 'page' : undefined}
                  onClick={() => p.onOpen(n)}
                >
                  {titleOf(n)}
                </button>
                <IconButton label={t.notes.closeTab(titleOf(n))} onClick={() => p.onCloseTab(n.id)}>
                  <Icon name="close" size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div role="group" aria-label={t.notes.notebooks} className={styles.chips}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filter === 'all'}
          onClick={() => p.onFilter('all')}
        >
          {t.notes.allPages} · {total}
        </button>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filter === 'none'}
          onClick={() => p.onFilter('none')}
        >
          {t.notes.general} · {counts.get(null) ?? 0}
        </button>
        {books.map((b) => (
          <button
            key={b.id}
            type="button"
            className={styles.chip}
            aria-pressed={filter === b.id}
            onClick={() => p.onFilter(b.id)}
          >
            <span
              className={styles.dot}
              style={{ background: categoryColor(b.tone) }}
              aria-hidden="true"
            />
            <Icon name={b.icon as IconName} size={14} />
            {b.name} · {counts.get(b.id) ?? 0}
          </button>
        ))}
        <IconButton label={t.notes.newNotebook} onClick={p.onNewNotebook}>
          <Icon name="plus" size={18} />
        </IconButton>
        {activeBook ? (
          <IconButton label={t.notes.editNotebook} onClick={() => p.onEditNotebook(activeBook)}>
            <Icon name="edit" size={18} />
          </IconButton>
        ) : null}
      </div>

      <SelectField
        label={t.notes.sort}
        labelHidden
        value={sort}
        onChange={(e) => p.onSort(e.target.value as SortMode)}
      >
        {SORT_MODES.map((m) => (
          <option key={m} value={m}>
            {m === 'recent'
              ? t.notes.sortRecent
              : m === 'title'
                ? t.notes.sortTitle
                : t.notes.sortManual}
          </option>
        ))}
      </SelectField>

      {pages && rest.length === 0 && (query.trim() || filter !== 'all') ? (
        <EmptyState title={t.notes.emptyFiltered} />
      ) : null}
      {pages && total === 0 && !query.trim() && filter === 'all' ? (
        <EmptyState title={t.notes.empty}>
          <StartDataButton moduleId="notes" />
        </EmptyState>
      ) : null}

      <div role="group" aria-label={t.notes.title} className={styles.rows}>
        {!query.trim() && !scratch && pages ? (
          <Row
            id="scratch-new"
            title={t.notes.scratch}
            meta={t.notes.scratchHint}
            pinned
            active={p.activeId === 'scratch'}
            onOpen={() => p.onOpen({ id: 'scratch' } as Page)}
          />
        ) : null}
        {scratch ? (
          <Row
            id={scratch.id}
            title={t.notes.scratch}
            meta={excerpt(scratch)}
            pinned
            active={p.activeId === scratch.id}
            onOpen={() => p.onOpen(scratch)}
          />
        ) : null}
        {manual ? (
          <SortableList
            items={rest}
            getId={(n) => n.id}
            getLabel={titleOf}
            onReorder={(ids) => p.onReorder(orderPatches(ids, rest))}
            renderItem={(n, _i, handle) => (
              <PageRow page={n} handle={handle} book={bookOf.get(n.notebookId ?? '')} {...p} />
            )}
          />
        ) : (
          rest.map((n) => (
            <PageRow key={n.id} page={n} book={bookOf.get(n.notebookId ?? '')} {...p} />
          ))
        )}
      </div>

      <div className={styles.foot}>
        <Button variant="ghost" onClick={p.onOpenTrash}>
          <Icon name="trash" size={16} />
          {t.notes.trash}
        </Button>
      </div>
    </nav>
  );
}

function PageRow({
  page,
  book,
  handle,
  ...p
}: PageListProps & { page: Page; book: Book | undefined; handle?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const items: RowMenuItem[] = [
    {
      id: 'pin',
      label: page.pinned ? t.notes.unpin : t.notes.pin,
      onSelect: () => p.onTogglePin(page),
    },
    { id: 'move', label: t.notes.moveTo, onSelect: () => p.onMove(page) },
    { id: 'delete', label: t.actions.delete, danger: true, onSelect: () => p.onDelete(page) },
  ];
  return (
    <Row
      id={page.id}
      title={titleOf(page)}
      meta={(p.query.trim() && matchSnippet(page, p.query)) || excerpt(page)}
      pinned={page.pinned}
      book={book}
      active={p.activeId === page.id}
      handle={handle}
      onOpen={() => p.onOpen(page)}
      menu={<RowMenu label={t.notes.pageMenu} items={items} open={open} onOpenChange={setOpen} />}
    />
  );
}

function Row({
  title,
  meta,
  pinned,
  book,
  active,
  handle,
  menu,
  onOpen,
}: {
  id: string;
  title: string;
  meta: string;
  pinned?: boolean;
  book?: Book;
  active: boolean;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <div
      className={active ? `${styles.row} ${styles.rowActive}` : styles.row}
      data-testid="note-row"
    >
      {handle}
      <button
        type="button"
        className={styles.main}
        aria-current={active ? 'page' : undefined}
        onClick={onOpen}
      >
        <span className={styles.title}>
          {pinned ? <Icon name="pin" size={14} /> : null}
          {title}
        </span>
        {book ? (
          <span className={styles.bookTag}>
            <span
              className={styles.dot}
              style={{ background: categoryColor(book.tone) }}
              aria-hidden="true"
            />
            {book.name}
          </span>
        ) : null}
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </button>
      {menu}
    </div>
  );
}
