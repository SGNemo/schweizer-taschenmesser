import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Badge, Dialog, Icon, IconButton, ItemList, ItemRow } from '@/ui';
import { pickShoppingTarget, splitArchived } from '../logic';
import { moveList } from '../repo';
import type { Item, List } from '../schema';
import { archiveWithUndo, deleteListWithUndo, ListMark } from './ListEditor';
import styles from './ListManage.module.css';

/**
 * "Listen verwalten": every list in tab order with its icon, kind and size. Arrows reorder, the row menu archives,
 * brings back, edits or deletes (always with "Rückgängig"). The first shopping list is marked: it receives what the
 * pantry, quick capture and the assistant want to buy.
 */
export function ManageLists({
  open,
  lists,
  items,
  onClose,
  onEdit,
  onOpenList,
  onArchived,
}: {
  open: boolean;
  lists: readonly Stored<List>[];
  items: readonly Pick<Item, 'listId'>[];
  onClose: () => void;
  onEdit: (list: Stored<List>) => void;
  onOpenList: (id: string) => void;
  /** Called with the id of a list that was just archived (the page leaves it). */
  onArchived: (id: string) => void;
}) {
  const { active, archived } = splitArchived(lists);
  const target = pickShoppingTarget(lists);
  const count = (id: string) => items.filter((i) => i.listId === id).length;
  const detail = (l: Stored<List>) =>
    [t.lists.kinds[l.kind], t.lists.itemCount(count(l.id))].join(' · ');

  const row = (l: Stored<List>, index: number, inUse: boolean) => (
    <ItemRow
      key={l.id}
      title={l.name}
      lead={<ListMark list={l} />}
      meta={
        <>
          {detail(l)}
          {l.id === target?.id ? (
            <>
              {' '}
              <Badge tone="info">{t.lists.shoppingTarget}</Badge>
            </>
          ) : null}
        </>
      }
      onOpen={() => {
        onOpenList(l.id);
        onClose();
      }}
      actions={
        inUse ? (
          <span className={styles.rowActions}>
            <IconButton
              label={t.lists.moveUp(l.name)}
              disabled={index === 0}
              onClick={() => void moveList(l.id, -1)}
            >
              <Icon name="chevronUp" />
            </IconButton>
            <IconButton
              label={t.lists.moveDown(l.name)}
              disabled={index === active.length - 1}
              onClick={() => void moveList(l.id, 1)}
            >
              <Icon name="chevronDown" />
            </IconButton>
          </span>
        ) : undefined
      }
      menuLabel={t.lists.editListNamed(l.name)}
      menu={[
        { id: 'edit', label: t.lists.editList, onSelect: () => onEdit(l) },
        inUse
          ? {
              id: 'archive',
              label: t.lists.archive,
              onSelect: () => {
                archiveWithUndo(l, true);
                onArchived(l.id);
              },
            }
          : {
              id: 'unarchive',
              label: t.lists.unarchive,
              onSelect: () => archiveWithUndo(l, false),
            },
        {
          id: 'delete',
          label: t.lists.deleteList,
          danger: true,
          onSelect: () => deleteListWithUndo(l.id),
        },
      ]}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} title={t.lists.manage}>
      <p className={styles.hint}>{t.lists.manageHint}</p>
      <div data-testid="lists-manage">
        <ItemList label={t.lists.tabsLabel}>{active.map((l, i) => row(l, i, true))}</ItemList>
      </div>
      {archived.length > 0 ? (
        <section className={styles.section} aria-label={t.lists.archivedTitle}>
          <h3>{t.lists.archivedTitle}</h3>
          <p className={styles.hint}>{t.lists.archiveHint}</p>
          <div data-testid="lists-archived">
            <ItemList label={t.lists.archivedTitle}>
              {archived.map((l, i) => row(l, i, false))}
            </ItemList>
          </div>
        </section>
      ) : null}
    </Dialog>
  );
}
