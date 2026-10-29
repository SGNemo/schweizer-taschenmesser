import type { Stored } from '@/core/db/types';
import { copyData } from '@/core/db/copy';
import { getPlatform } from '@/core/platform';
import { deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Checkbox, ItemRow, type RowMenuItem } from '@/ui';
import { hostOf } from '../logic';
import { itemRepo } from '../repo';
import type { BookmarkItem } from '../schema';

/**
 * The "⋯" entries of one saved item: edit, copy the link, filter by one of its tags (only where
 * the page has a tag filter: `filterTag`), duplicate, delete.
 */
export function bookmarkMenu(
  item: Stored<BookmarkItem>,
  on: { edit: (item: Stored<BookmarkItem>) => void; filterTag?: (tag: string) => void },
): RowMenuItem[] {
  return [
    { id: 'edit', label: t.actions.edit, onSelect: () => on.edit(item) },
    ...(item.url
      ? [
          {
            id: 'copy-link',
            label: t.bookmarks.copyLink,
            onSelect: () =>
              void getPlatform()
                .clipboard.writeText(item.url!)
                .then(() => useUiStore.getState().toast(t.bookmarks.linkCopied)),
          },
        ]
      : []),
    ...(on.filterTag
      ? item.tags.map((tag) => ({
          id: `tag-${tag}`,
          group: t.bookmarks.filterTags,
          label: tag,
          onSelect: () => on.filterTag!(tag),
        }))
      : []),
    {
      id: 'duplicate',
      label: t.actions.duplicate,
      onSelect: () =>
        void undoableWithToast(t.actions.duplicated, t.actions.duplicated, () =>
          itemRepo.create({ ...copyData(item), done: false }),
        ),
    },
    {
      id: 'delete',
      label: t.actions.delete,
      danger: true,
      onSelect: () => void deleteWithUndo(() => itemRepo.remove(item.id)),
    },
  ];
}

/**
 * One saved item: the title is the one link (an item with an address opens it in a new tab, one
 * without opens the editor), one context line (type, domain, tags as text), the done box and a "⋯"
 * menu for everything else.
 */
export function BookmarkRow({
  item,
  onEdit,
  onFilterTag,
}: {
  item: Stored<BookmarkItem>;
  onEdit: (item: Stored<BookmarkItem>) => void;
  onFilterTag: (tag: string) => void;
}) {
  return (
    <ItemRow
      title={item.title}
      href={item.url}
      onOpen={() => onEdit(item)}
      done={item.done}
      lead={
        <Checkbox
          aria-label={`${t.bookmarks.done}: ${item.title}`}
          label=""
          checked={item.done}
          onChange={(e) => void itemRepo.update(item.id, { done: e.target.checked })}
        />
      }
      meta={[t.bookmarks.kinds[item.kind], hostOf(item.url), ...item.tags.map((x) => `#${x}`)]
        .filter(Boolean)
        .join(' · ')}
      menu={bookmarkMenu(item, { edit: onEdit, filterTag: onFilterTag })}
    />
  );
}
