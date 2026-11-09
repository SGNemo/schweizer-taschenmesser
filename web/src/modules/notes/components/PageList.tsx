import { useEffect, useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { compareText } from '@/core/i18n/format';
import { t } from '@/strings';
import {
  Button,
  categoryColor,
  EmptyState,
  FolderTabs,
  Icon,
  IconButton,
  RowMenu,
  Segmented,
  SortableList,
  TextField,
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
import { TEMPLATE_IDS, type TemplateId } from '../templates';
import { pageMenuItems } from './pageMenu';
import { SignatureMark } from '@/ui/identity';
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
  onNewFromTemplate: (id: TemplateId) => void;
  view: 'list' | 'cards';
  onView: (v: 'list' | 'cards') => void;
  onNewNotebook: () => void;
  onEditNotebook: (book: Book) => void;
  onTogglePin: (page: Page) => void;
  onMove: (page: Page) => void;
  onDelete: (page: Page) => void;
  /** „In den Plan“ in the page menu; absent while the planner is off. */
  onPlan?: (page: Page) => void;
  onReorder: (patches: { id: string; order: number }[]) => void;
  onOpenTrash: () => void;
  onExport: () => void;
  onImport: () => void;
}

const titleOf = (n: Page) => (isScratch(n) ? t.notes.scratch : displayTitle(n) || t.notes.untitled);

export function PageList(p: PageListProps) {
  const { pages, books, filter, sort, query } = p;
  const [tplOpen, setTplOpen] = useState(false);
  // The search waits behind its icon until it is wanted; an active search keeps the field open.
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || query !== '';
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
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
        {showSearch ? null : (
          <IconButton label={t.notes.search} onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={18} />
          </IconButton>
        )}
        <RowMenu
          label={t.notes.moreMenu}
          open={tplOpen}
          onOpenChange={setTplOpen}
          items={[
            {
              id: 'blank',
              label: t.notes.templates.blank,
              onSelect: p.onNewPage,
              group: t.notes.templates.button,
            },
            ...TEMPLATE_IDS.map((id) => ({
              id,
              label: t.notes.templates[id],
              onSelect: () => p.onNewFromTemplate(id),
              group: t.notes.templates.button,
            })),
            ...SORT_MODES.map((m) => ({
              id: `sort-${m}`,
              label:
                m === 'recent'
                  ? t.notes.sortRecent
                  : m === 'title'
                    ? t.notes.sortTitle
                    : t.notes.sortManual,
              onSelect: () => p.onSort(m),
              checked: sort === m,
              group: t.notes.sort,
            })),
          ]}
        />
      </div>
      {showSearch ? (
        <TextField
          label={t.notes.search}
          labelHidden
          placeholder={t.notes.search}
          type="search"
          value={query}
          ref={searchRef}
          onChange={(e) => p.onQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
        />
      ) : null}

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

      <div className={styles.tabsRow}>
        <FolderTabs
          label={t.notes.notebooks}
          value={filter}
          onChange={p.onFilter}
          tabs={[
            { id: 'all', label: `${t.notes.allPages} · ${total}` },
            { id: 'none', label: `${t.notes.general} · ${counts.get(null) ?? 0}` },
            ...books.map((b) => ({
              id: b.id,
              label: `${b.name} · ${counts.get(b.id) ?? 0}`,
              color: categoryColor(b.tone),
              icon: <Icon name={b.icon as IconName} size={14} />,
            })),
          ]}
        >
          <IconButton label={t.notes.newNotebook} onClick={p.onNewNotebook}>
            <Icon name="plus" size={18} />
          </IconButton>
          {activeBook ? (
            <IconButton label={t.notes.editNotebook} onClick={() => p.onEditNotebook(activeBook)}>
              <Icon name="edit" size={18} />
            </IconButton>
          ) : null}
        </FolderTabs>
      </div>

      <div className={styles.viewSwitch}>
        <Segmented
          label={t.notes.view.label}
          value={p.view}
          options={[
            { value: 'list', label: t.notes.view.list },
            { value: 'cards', label: t.notes.view.cards },
          ]}
          onChange={(v) => p.onView(v === 'cards' ? 'cards' : 'list')}
        />
      </div>

      {pages && rest.length === 0 && (query.trim() || filter !== 'all') ? (
        <EmptyState
          title={t.notes.emptyFiltered}
          testId="notes-empty"
          motif={<SignatureMark id="notePaper" size={64} />}
        />
      ) : null}
      {pages && total === 0 && !query.trim() && filter === 'all' ? (
        <EmptyState
          title={t.notes.empty}
          testId="notes-empty"
          motif={<SignatureMark id="notePaper" size={64} />}
        />
      ) : null}

      <div
        role="group"
        aria-label={t.notes.title}
        className={p.view === 'cards' ? `${styles.rows} ${styles.cards}` : styles.rows}
      >
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
        <Button variant="ghost" onClick={p.onExport} data-testid="notes-export">
          <Icon name="download" size={16} />
          {t.notes.exportMenu.button}
        </Button>
        <Button variant="ghost" onClick={p.onImport} data-testid="notes-import">
          <Icon name="upload" size={16} />
          {t.notes.importMenu.button}
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
  const items = pageMenuItems(page, p);
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
      style={book ? ({ '--strip': categoryColor(book.tone) } as React.CSSProperties) : undefined}
    >
      {handle}
      <button
        type="button"
        className={styles.main}
        aria-current={active ? 'page' : undefined}
        onClick={onOpen}
      >
        <span className={styles.title} title={title}>
          {pinned ? <Icon name="pin" size={14} /> : null}
          <span className={styles.titleText}>{title}</span>
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
