import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import type { Stored } from '@/core/db/types';
import { useUiStore } from '@/stores/ui';
import { undoableWithToast } from '@/core/undo/withToast';
import { formatDay, today, daysBetween } from '@/core/time/dates';
import { formatMoney } from '@/core/money';
import { t } from '@/strings';
import {
  Badge,
  Button,
  EmptyState,
  Checkbox,
  Dialog,
  Icon,
  GroupedList,
  IconButton,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Progress,
  Tabs,
  TextField,
  useOpenParam,
} from '@/ui';
import { ItemEditor } from '../components/ItemEditor';
import { SignatureMark } from '@/ui/identity';
import { ListEditor, type ListTarget } from '../components/ListEditor';
import {
  groupItems,
  listAsText,
  PACKING_TEMPLATES,
  progress,
  sortItems,
  sortLists,
  suggestNames,
  totals,
} from '../logic';
import { TripWeather } from '../components/TripWeather';
import { ListFigure, ListSummary } from '../components/ListSignature';
import {
  addItem,
  clearDone,
  duplicateList,
  ensureShoppingList,
  historyOf,
  itemRepo,
  listRepo,
  resetList,
} from '../repo';
import type { Item } from '../schema';
import { addRequested } from '../services';
import { createPackingFromTemplate, createRoutine, ROUTINES } from '../templates';
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
  const [category, setCategory] = useState('');
  const moduleStates = useModuleStates();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const toast = useUiStore((x) => x.toast);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void ensureShoppingList();
  }, []);

  // `?new=1` (Quick-Add, the "+ Neu" menu) focuses the add field.
  // The field is the last row of a list, so it exists only once the lists are loaded: the parameter waits for it.
  const loaded = (lists?.length ?? 0) > 0;
  useEffect(() => {
    const input = form.current?.querySelector('input');
    if (params.get('new') && loaded && input) {
      input.scrollIntoView({ block: 'center' });
      input.focus({ preventScroll: true });
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams, loaded]);

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
  const isShopping = current?.kind === 'shopping';
  const isPacking = current?.kind === 'packing';
  const sums = totals(shown);
  const history = useLiveQuery(
    async () => (current && isShopping ? await historyOf(current.id) : []),
    [current?.id, isShopping, items],
  );
  const suggestions = useMemo(
    () =>
      isShopping
        ? suggestNames(
            history ?? [],
            shown.filter((i) => !i.done).map((i) => i.name),
          )
        : [],
    [history, shown, isShopping],
  );
  const toBuy = shown.filter((i) => i.toBuy && !i.done);
  const categories = useMemo(
    () => [...new Set(shown.map((i) => i.category).filter((c): c is string => !!c))],
    [shown],
  );
  const tripLine = (() => {
    if (!current || !isPacking) return undefined;
    const parts: string[] = [];
    if (current.place) parts.push(current.place);
    if (current.tripDate) {
      const d = daysBetween(today(), current.tripDate);
      parts.push(
        d < 0
          ? t.lists.tripPast
          : d === 0
            ? t.lists.tripToday
            : d === 1
              ? t.lists.tripTomorrow
              : t.lists.tripIn(d),
      );
      parts.push(formatDay(current.tripDate, 'dd.MM.yyyy'));
    }
    return parts.join(' · ') || undefined;
  })();

  async function share() {
    if (!current) return;
    const text = listAsText(current.name, shown);
    try {
      if (typeof navigator.share === 'function')
        await navigator.share({ title: current.name, text });
      else {
        await navigator.clipboard.writeText(text);
        void toast(t.lists.shareCopied);
      }
    } catch {
      // the share sheet was closed: nothing to do
    }
  }

  /** Bought goods go to the pantry (amount added to the item of that name), then the bought entries are cleared. */
  async function toPantry() {
    if (!current) return;
    const bought = shown.filter((i) => i.done);
    await whenServicesSettled();
    for (const i of bought)
      await bus.emit('pantry.restock', {
        name: i.name,
        ...(i.quantity ? { quantity: i.quantity } : {}),
      });
    await clearDone(current.id);
    void toast(t.lists.toPantryDone(bought.length));
  }

  async function sendToBuy() {
    for (const i of toBuy) {
      await addRequested({ name: i.name, ...(i.quantity ? { quantity: i.quantity } : {}) });
      await itemRepo.update(i.id, { toBuy: undefined });
    }
    void toast(t.lists.buyMissingDone(toBuy.length));
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    await addItem(current.id, text, current.kind, { category: isPacking ? category.trim() : '' });
    setText('');
  }

  const groups = groupItems(shown, isShopping ? 'section' : 'category');
  const groupLabel = (id: string) =>
    isShopping ? (id ? t.lists.sections[id]! : t.lists.noSection) : id || t.lists.sections.other!;

  const renderRow = (i: Stored<Item>) => (
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
      end={
        <span className={styles.meta}>
          {i.toBuy ? <Badge tone="info">{t.lists.toBuyBadge}</Badge> : null}
          {i.recurring ? <Badge>{t.lists.recurringBadge}</Badge> : null}
          {i.priceCents !== undefined ? (
            <span className={styles.quantity}>{formatMoney(i.priceCents)}</span>
          ) : null}
          {i.quantity ? <span className={styles.quantity}>{i.quantity}</span> : null}
        </span>
      }
      // The whole row ticks; the pencil (and the dialog behind it) edits and deletes.
      onOpen={() => tick(i, !i.done)}
      onSwipeRight={() => tick(i, !i.done)}
      swipeRightLabel={t.lists.swipeDone}
      onSwipeLeft={() =>
        void undoableWithToast(t.lists.removedItem(i.name), t.lists.removedItem(i.name), () =>
          itemRepo.remove(i.id),
        )
      }
      swipeLeftLabel={t.actions.delete}
      actions={
        <IconButton label={t.lists.editItem} onClick={() => setEditingItem(i)}>
          <Icon name="edit" />
        </IconButton>
      }
    />
  );

  const openCount = shown.filter((i) => !i.done).length;
  /** The add field is the list's last row; on a long list this entry (and `?new=1`) leads to it. */
  const focusAdd = () => {
    const input = form.current?.querySelector('input');
    input?.scrollIntoView({ block: 'center' });
    input?.focus({ preventScroll: true });
  };
  const clearBought = () => {
    if (!current) return;
    const id = current.id;
    void undoableWithToast(t.lists.cleared(doneCount), t.lists.cleared(doneCount), () =>
      clearDone(id),
    );
  };
  const pageMenu = current
    ? [
        { id: 'add-item', label: t.lists.addItem, onSelect: focusAdd },
        ...(isShopping && doneCount > 0
          ? [{ id: 'clear-bought', label: t.lists.clearBought(doneCount), onSelect: clearBought }]
          : []),
        { id: 'templates', label: t.lists.routines.title, onSelect: () => setTemplates(true) },
        { id: 'edit-list', label: t.lists.editList, onSelect: () => setListTarget(current) },
        ...(toBuy.length > 0
          ? [
              {
                id: 'buy-missing',
                label: t.lists.buyMissing(toBuy.length),
                onSelect: () => void sendToBuy(),
              },
            ]
          : []),
        ...(isShopping && doneCount > 0 && moduleStates?.pantry === true
          ? [
              {
                id: 'to-pantry',
                label: t.lists.toPantry(doneCount),
                onSelect: () => void toPantry(),
              },
            ]
          : []),
        ...(!isShopping
          ? [
              ...(doneCount > 0
                ? [
                    {
                      id: 'reset',
                      label: t.lists.reset,
                      onSelect: () =>
                        void undoableWithToast(t.lists.resetDone, t.lists.resetDone, () =>
                          resetList(current.id),
                        ),
                    },
                  ]
                : []),
              {
                id: 'duplicate',
                label: t.lists.duplicate,
                onSelect: () =>
                  void undoableWithToast(t.lists.duplicated, t.lists.duplicated, async () => {
                    const id = await duplicateList(current.id);
                    setParams({ list: id }, { replace: true });
                  }),
              },
            ]
          : []),
        { id: 'share', label: t.lists.share, onSelect: () => void share() },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t.lists.title}
        besideContent={shown.length > 0 || !!tripLine}
        views={
          lists && current ? (
            <Tabs
              label={t.lists.tabsLabel}
              items={sorted.map((l) => ({ id: l.id, label: l.name, active: l.id === current.id }))}
              onSelect={(id) => {
                setParams({ list: id }, { replace: true });
              }}
            />
          ) : undefined
        }
      >
        {/* Rule 4: items are added in the list's last row; the head's action (the plus on the phone) is a new
            list, as `e2e/mobile-layout.spec.ts` pins it. */}
        <PageAction short={t.nav.plusThings.list} onClick={() => setListTarget('new')}>
          <Icon name="plus" size={18} />
          {t.lists.newList}
        </PageAction>
        {/* Everything occasional: templates, editing, sharing, clearing a packing list. */}
        <StartDataMenu moduleId="lists" items={pageMenu} />
      </PageHeader>
      {lists && current && isShopping ? (
        <ListFigure
          name={current.name}
          open={openCount}
          detail={groups.length > 0 ? t.lists.sectionsCount(groups.length) : undefined}
        />
      ) : null}
      {lists && current ? (
        <>
          {/* The first row of the page: on the phone the "⋯" menu lies beside it (`besideContent`). An empty list
              has no such line; its empty state says it. */}
          {shown.length === 0 ? (
            tripLine ? (
              <ListSummary>{tripLine}</ListSummary>
            ) : null
          ) : isShopping ? (
            <ListSummary testId="lists-sums" note={sums.priced > 0 ? t.lists.sumNote : undefined}>
              {sums.priced > 0 ? (
                <>
                  <span>{t.lists.sumOpen(formatMoney(sums.openCents))}</span>
                  {' · '}
                  <span>{t.lists.sumBasket(formatMoney(sums.doneCents))}</span>
                </>
              ) : (
                // The head's figure is the open count; this line adds what is in the basket.
                t.lists.inBasket(doneCount, shown.length)
              )}
            </ListSummary>
          ) : (
            <div className={styles.progress} data-testid="lists-progress">
              <ListSummary>
                {[
                  isPacking
                    ? t.lists.progressPacked(stats.done, stats.total)
                    : t.lists.progress(stats.done, stats.total),
                  stats.complete ? (isPacking ? t.lists.completePacked : t.lists.complete) : '',
                  tripLine ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ListSummary>
              <Progress value={stats.done} max={stats.total} label={current.name} />
            </div>
          )}
          {isPacking && current.place && current.tripDate ? (
            <TripWeather
              key={`${current.id}|${current.place}|${current.tripDate}`}
              place={current.place}
              tripDate={current.tripDate}
            />
          ) : null}
          {items && shown.length === 0 ? (
            <EmptyState
              title={t.lists.empty}
              testId="lists-empty"
              motif={
                <SignatureMark
                  id={current.kind === 'shopping' ? 'receipt' : 'todayCard'}
                  size={64}
                />
              }
            />
          ) : null}
          <div
            className={isShopping ? styles.paper : styles.sheet}
            data-testid={isShopping && shown.length > 0 ? 'receipt-paper' : undefined}
          >
            {shown.length === 0 ? null : groups.length === 1 && groups[0]!.id === '' ? (
              <ItemList label={current.name}>{shown.map(renderRow)}</ItemList>
            ) : (
              <GroupedList
                listId={current.id}
                label={current.name}
                groups={groups.map((g) => ({
                  id: g.id || 'none',
                  label: groupLabel(g.id),
                  count: g.items.length,
                  children: <ItemList label={groupLabel(g.id)}>{g.items.map(renderRow)}</ItemList>,
                }))}
              />
            )}
            {/* Rule 4: the add field stays, as the quiet last row of the list. */}
            <form ref={form} onSubmit={add} className={styles.add} data-testid="lists-add">
              <TextField
                label={t.lists.addItem}
                labelHidden
                placeholder={t.lists.placeholder[current.kind]}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                data-list-search
              />
              {isPacking ? (
                <TextField
                  label={t.lists.categoryNow}
                  labelHidden
                  placeholder={t.lists.categoryNow}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  list="lists-categories"
                  autoComplete="off"
                />
              ) : null}
              <Button type="submit" variant="ghost">
                {t.actions.add}
              </Button>
            </form>
            <datalist id="lists-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {suggestions.length > 0 ? (
            <section aria-label={t.lists.suggestions} className={styles.suggest}>
              <Button
                variant="ghost"
                aria-expanded={showSuggestions}
                onClick={() => setShowSuggestions((v) => !v)}
              >
                {t.lists.suggestionsToggle(suggestions.length)}
              </Button>
              {(showSuggestions ? suggestions : []).map((name) => (
                <Button
                  key={name}
                  onClick={() => void addItem(current.id, name, current.kind)}
                  aria-label={t.lists.suggestAdd(name)}
                >
                  + {name}
                </Button>
              ))}
            </section>
          ) : null}
          {/* After shopping: one tap clears what is in the basket (shown only then; also in the "⋯" menu). */}
          {isShopping && doneCount > 0 ? (
            <div className={styles.suggest}>
              <Button variant="ghost" onClick={clearBought}>
                {t.lists.clearBought(doneCount)}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <Dialog open={templates} onClose={() => setTemplates(false)} title={t.lists.routines.title}>
        <p>{t.lists.routines.hint}</p>
        <ul className={styles.templates}>
          {ROUTINES.map((id) =>
            // Focus checklist 9 (planner package 2): with the planner on, its „Woche prüfen“ replaces the
            // weekly routine – one place for the week; lists made from the template stay as they are.
            id === 'week' && moduleStates?.planner ? (
              <li key={id}>
                <Link to="/planner?check=1" onClick={() => setTemplates(false)}>
                  {t.lists.routines.weekInPlanner}
                </Link>
              </li>
            ) : (
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
            ),
          )}
        </ul>
        <h3>{t.lists.fromTemplate}</h3>
        <ul className={styles.templates}>
          {PACKING_TEMPLATES.map((id) => (
            <li key={id}>
              <Button
                onClick={() => {
                  void createPackingFromTemplate(id).then((listId) => {
                    setTemplates(false);
                    setParams({ list: listId }, { replace: true });
                    toast(t.lists.routines.created);
                  });
                }}
              >
                {t.onboarding.lists[id].name}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
      <ItemEditor
        item={editingItem}
        kind={current?.kind ?? 'checklist'}
        onClose={() => setEditingItem(null)}
      />
      <ListEditor
        target={listTarget}
        existing={lists ?? []}
        onClose={() => setListTarget(null)}
        onSaved={(id) => setParams({ list: id }, { replace: true })}
      />
    </>
  );
}
