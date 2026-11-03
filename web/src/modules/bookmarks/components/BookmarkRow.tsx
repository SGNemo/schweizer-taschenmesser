import type { Stored } from '@/core/db/types';
import { copyData } from '@/core/db/copy';
import { bus } from '@/core/events';
import { loadModuleStates } from '@/core/modules/activation';
import { offerEnableModule } from '@/core/modules/offerEnable';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { getPlatform } from '@/core/platform';
import { deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Checkbox, ItemRow, type RowMenuItem } from '@/ui';
import { hostOf, statusOf } from '../logic';
import { itemRepo } from '../repo';
import type { BookmarkItem } from '../schema';

/**
 * The "⋯" entries of one saved item: edit, copy the link, filter by one of its tags (only where
 * the page has a tag filter: `filterTag`), duplicate, delete.
 */
export function bookmarkMenu(
  item: Stored<BookmarkItem>,
  on: {
    edit: (item: Stored<BookmarkItem>) => void;
    filterTag?: (tag: string) => void;
    read?: (item: Stored<BookmarkItem>) => void;
  },
): RowMenuItem[] {
  const status = statusOf(item);
  return [
    { id: 'edit', label: t.actions.edit, onSelect: () => on.edit(item) },
    ...(on.read && item.url?.startsWith('https://')
      ? [{ id: 'read', label: t.bookmarks.reader.open, onSelect: () => on.read!(item) }]
      : []),
    ...(status !== 'started'
      ? [
          {
            id: 'started',
            label: t.bookmarks.markStarted,
            onSelect: () => void itemRepo.update(item.id, { started: true, done: false }),
          },
        ]
      : []),
    ...(status !== 'done'
      ? [
          {
            id: 'done',
            label: t.bookmarks.markDone,
            onSelect: () => void itemRepo.update(item.id, { done: true, started: false }),
          },
        ]
      : [
          {
            id: 'reopen',
            label: t.bookmarks.markOpen,
            onSelect: () => void itemRepo.update(item.id, { done: false, started: false }),
          },
        ]),
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
    ...(item.url
      ? [
          {
            id: 'gift-idea',
            label: t.bookmarks.asGift,
            onSelect: () => {
              const send = async () => {
                await bus.emit('gift.requested', { title: item.title, url: item.url! });
                void useUiStore.getState().toast(t.bookmarks.giftSent);
              };
              void loadModuleStates().then((states) =>
                states.people === true
                  ? whenServicesSettled().then(send)
                  : offerEnableModule('people', t.bookmarks.giftOff, send),
              );
            },
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
          itemRepo.create({ ...copyData(item), done: false, started: false }),
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
  onRead,
}: {
  item: Stored<BookmarkItem>;
  onEdit: (item: Stored<BookmarkItem>) => void;
  onFilterTag: (tag: string) => void;
  onRead?: (item: Stored<BookmarkItem>) => void;
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
      meta={[
        t.bookmarks.kinds[item.kind],
        statusOf(item) === 'started' ? t.bookmarks.statuses.started : undefined,
        hostOf(item.url),
        ...item.tags.map((x) => `#${x}`),
      ]
        .filter(Boolean)
        .join(' · ')}
      menu={bookmarkMenu(item, { edit: onEdit, filterTag: onFilterTag, read: onRead })}
    />
  );
}
