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
  Tabs,
  TextField,
  useOpenParam,
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

/** A ticked entry keeps its place this long (with "Rückgängig" in the notice) before it moves down. */
const HOLD_MS = 4000;

function toggle(item: Stored<Item>, done: boolean) {
  const message = done ? t.lists.tickedItem(item.name) : t.lists.reopenedItem(item.name);
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

  // A search hit links here with ?open=<id> of a list or an item: show that list.
  useOpenParam(
    async (id) => (await listRepo.get(id)) ?? (await itemRepo.get(id)),
    (r) => ({ list: 'listId' in r ? r.listId : r.id }),
  );
  const sorted = useMemo(() => sortLists(lists ?? []), [lists]);
  const current = sorted.find((l) => l.id === params.get('list')) ?? sorted[0];
  // id -> `done` before the change: such an entry sorts as if nothing changed until HOLD_MS is over.
  const [held, setHeld] = useState<ReadonlyMap<string, boolean>>(new Map());
  const shown = useMemo(() => {
    const own = (items ?? []).filter((i) => i.listId === current?.id);
    const order = sortItems(own.map((i) => (held.has(i.id) ? { ...i, done: held.get(i.id)! } : i)));
    const byId = new Map(own.map((i) => [i.id, i]));
    return order.map((i) => byId.get(i.id)!);
  }, [items, current?.id, held]);
  const tick = (item: Stored<Item>, done: boolean) => {
    const id = item.id;
    setHeld((m) => (m.has(id) ? m : new Map(m).set(id, item.done)));
    setTimeout(
      () =>
        setHeld((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      HOLD_MS,
    );
    toggle(item, done);
  };
  const doneCount = shown.filter((i) => i.done).length;
  const stats = progress(shown);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    await addItem(current.id, text, current.kind);
    setText('');
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
                titleFull
                done={i.done}
                lead={
                  <Checkbox
                    label={i.name}
                    labelHidden
                    checked={i.done}
                    onChange={(e) => tick(i, e.target.checked)}
                    data-row-tick
                  />
                }
                end={i.quantity ? <span className={styles.quantity}>{i.quantity}</span> : undefined}
                // The whole row ticks; the pencil (and the dialog behind it) edits and deletes.
                onOpen={() => tick(i, !i.done)}
                onSwipeRight={() => tick(i, !i.done)}
                swipeRightLabel={t.lists.swipeDone}
                onSwipeLeft={() =>
                  void undoableWithToast(
                    t.lists.removedItem(i.name),
                    t.lists.removedItem(i.name),
                    () => itemRepo.remove(i.id),
                  )
                }
                swipeLeftLabel={t.actions.delete}
                actions={
                  <IconButton label={t.lists.editItem} onClick={() => setEditingItem(i)}>
                    <Icon name="edit" />
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
