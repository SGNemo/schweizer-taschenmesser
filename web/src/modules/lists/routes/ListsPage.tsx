import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { StartDataButton } from '@/core/importer/StartDataButton';
import type { Stored } from '@/core/db/types';
import { useUiStore } from '@/stores/ui';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  SelectionBar,
  Tabs,
  TextField,
  useSelection,
} from '@/ui';
import { ItemEditor } from '../components/ItemEditor';
import { ListEditor, type ListTarget } from '../components/ListEditor';
import { progress, sortItems, sortLists } from '../logic';
import {
  addItem,
  clearDone,
  duplicateList,
  ensureShoppingList,
  itemRepo,
  listRepo,
  resetList,
} from '../repo';
import type { Item } from '../schema';
import { createRoutine, ROUTINES } from '../templates';
import styles from './lists.module.css';

function toggle(item: Stored<Item>, done: boolean) {
  const message = done ? t.lists.markedDone : t.lists.markedOpen;
  void undoableWithToast(message, message, () => itemRepo.update(item.id, { done }));
}

export default function ListsPage() {
  const lists = useLiveQuery(() => listRepo.active().toArray(), []);
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [editingItem, setEditingItem] = useState<Stored<Item> | null>(null);
  const [listTarget, setListTarget] = useState<ListTarget>(null);
  const [templates, setTemplates] = useState(false);
  const toast = useUiStore((x) => x.toast);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void ensureShoppingList();
  }, []);

  // `?new=1` (Quick-Add, the "+ Neu" menu) focuses the add field.
  useEffect(() => {
    if (params.get('new')) {
      form.current?.querySelector('input')?.focus();
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const sorted = useMemo(() => sortLists(lists ?? []), [lists]);
  const current = sorted.find((l) => l.id === params.get('list')) ?? sorted[0];
  const shown = useMemo(
    () => sortItems((items ?? []).filter((i) => i.listId === current?.id)),
    [items, current?.id],
  );
  const selection = useSelection(shown.map((i) => i.id));
  const doneCount = shown.filter((i) => i.done).length;
  const stats = progress(shown);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    await addItem(current.id, text, current.kind);
    setText('');
  }

  function bulk(action: 'done' | 'delete') {
    const picked = shown.filter((i) => selection.isSelected(i.id));
    selection.clear();
    if (action === 'delete') {
      void undoableWithToast(
        t.lists.itemsDeleted(picked.length),
        t.lists.itemsDeleted(picked.length),
        () => itemRepo.removeMany(picked.map((i) => i.id)),
      );
    } else {
      void undoableWithToast(t.lists.markedDone, t.lists.markedDone, async () => {
        for (const i of picked) await itemRepo.update(i.id, { done: true });
      });
    }
  }

  return (
    <>
      <PageHeader title={t.lists.title}>
        <Button onClick={() => setTemplates(true)}>{t.lists.routines.title}</Button>
        <Button variant="primary" onClick={() => setListTarget('new')}>
          <Icon name="plus" size={18} />
          {t.lists.newList}
        </Button>
      </PageHeader>
      {lists && current ? (
        <>
          <Tabs
            label={t.lists.tabsLabel}
            items={sorted.map((l) => ({ id: l.id, label: l.name, active: l.id === current.id }))}
            onSelect={(id) => {
              selection.clear();
              setParams({ list: id }, { replace: true });
            }}
          />
          <div className={styles.toolbar}>
            <form ref={form} onSubmit={add} className={styles.add}>
              <TextField
                label={t.lists.addItem}
                labelHidden
                placeholder={t.lists.placeholder[current.kind]}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                data-list-search
              />
              <Button type="submit" variant="primary">
                {t.actions.add}
              </Button>
            </form>
            <div className={styles.actions}>
              {current.kind === 'shopping' ? (
                <Button
                  disabled={doneCount === 0}
                  onClick={() =>
                    void undoableWithToast(
                      t.lists.cleared(doneCount),
                      t.lists.cleared(doneCount),
                      () => clearDone(current.id),
                    )
                  }
                >
                  {t.lists.clearBought(doneCount)}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={doneCount === 0}
                    onClick={() =>
                      void undoableWithToast(t.lists.resetDone, t.lists.resetDone, () =>
                        resetList(current.id),
                      )
                    }
                  >
                    {t.lists.reset}
                  </Button>
                  <Button
                    onClick={() =>
                      void undoableWithToast(t.lists.duplicated, t.lists.duplicated, async () => {
                        const id = await duplicateList(current.id);
                        setParams({ list: id }, { replace: true });
                      })
                    }
                  >
                    {t.lists.duplicate}
                  </Button>
                </>
              )}
              <IconButton label={t.lists.editList} onClick={() => setListTarget(current)}>
                <Icon name="edit" />
              </IconButton>
            </div>
          </div>
          {current.kind !== 'shopping' && stats.total > 0 ? (
            <div className={styles.progress} data-testid="lists-progress">
              <p>
                {current.kind === 'packing'
                  ? t.lists.progressPacked(stats.done, stats.total)
                  : t.lists.progress(stats.done, stats.total)}
                {stats.complete
                  ? ` · ${current.kind === 'packing' ? t.lists.completePacked : t.lists.complete}`
                  : ''}
              </p>
              <Progress value={stats.done} max={stats.total} label={current.name} />
            </div>
          ) : null}
          <SelectionBar count={selection.count} onCancel={selection.clear}>
            <Button size="sm" onClick={() => bulk('done')}>
              {t.lists.selectedDone}
            </Button>
            <Button size="sm" variant="quietDanger" onClick={() => bulk('delete')}>
              {t.lists.selectedDelete}
            </Button>
          </SelectionBar>
          {items && shown.length === 0 ? (
            <EmptyState title={t.lists.empty}>
              <StartDataButton moduleId="lists" />
            </EmptyState>
          ) : null}
          <ItemList label={current.name}>
            {shown.map((i) => (
              <ItemRow
                key={i.id}
                title={i.name}
                done={i.done}
                lead={
                  <Checkbox
                    label={i.name}
                    labelHidden
                    checked={i.done}
                    onChange={(e) => toggle(i, e.target.checked)}
                    data-row-tick
                  />
                }
                end={i.quantity ? <span className={styles.quantity}>{i.quantity}</span> : undefined}
                onOpen={() => setEditingItem(i)}
                selectable
                selected={selection.isSelected(i.id)}
                onSelectChange={(_, extend) => selection.toggle(i.id, extend)}
                onSwipeRight={() => toggle(i, !i.done)}
                swipeRightLabel={t.lists.swipeDone}
                actions={
                  <IconButton
                    label={t.actions.delete}
                    onClick={() =>
                      void undoableWithToast(t.lists.itemDeleted, t.lists.itemDeleted, () =>
                        itemRepo.remove(i.id),
                      )
                    }
                  >
                    <Icon name="trash" />
                  </IconButton>
                }
              />
            ))}
          </ItemList>
        </>
      ) : null}
      <Dialog open={templates} onClose={() => setTemplates(false)} title={t.lists.routines.title}>
        <p>{t.lists.routines.hint}</p>
        <ul className={styles.templates}>
          {ROUTINES.map((id) => (
            <li key={id}>
              <Button
                onClick={() => {
                  void createRoutine(id).then((listId) => {
                    setTemplates(false);
                    setParams({ list: listId }, { replace: true });
                    toast(t.lists.routines.created);
                  });
                }}
              >
                {t.lists.routines[id].name}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
      <ItemEditor item={editingItem} onClose={() => setEditingItem(null)} />
      <ListEditor
        target={listTarget}
        existing={lists ?? []}
        onClose={() => setListTarget(null)}
        onSaved={(id) => setParams({ list: id }, { replace: true })}
      />
    </>
  );
}
