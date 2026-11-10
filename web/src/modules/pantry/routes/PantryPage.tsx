import { NowStrip } from '@/core/modules/NowStrip';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { offerEnableModule } from '@/core/modules/offerEnable';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { useSettings } from '@/core/settings/settings';
import { today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { SignatureMark } from '@/ui/identity';
import { t } from '@/strings';
import {
  AdvancedToggle,
  Badge,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Segmented,
  useOpenParam,
} from '@/ui';
import { ItemEditor, type ItemTarget } from '../components/ItemEditor';
import {
  applyFilter,
  crossedMinimum,
  expiryState,
  expiryText,
  findByEan,
  needsRestock,
  sortItems,
  type Filter,
} from '../logic';
import { ScanDialog } from '../components/ScanDialog';
import { PantryHead, type ShelfCounts } from '../components/PantryHead';
import { itemRepo } from '../repo';
import { PLACES } from '../schema';
import { settings as moduleSettings, settingsSchema } from '../settings';
import styles from '@/pages/Page.module.css';
import lamp from './PantryPage.module.css';

export default function PantryPage() {
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [prefs] = useSettings('module.pantry', settingsSchema, moduleSettings.defaults as never);
  const soonDays = (prefs as { soonDays?: number } | undefined)?.soonDays ?? 3;
  const autoRestock = (prefs as { autoRestock?: boolean } | undefined)?.autoRestock ?? true;
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<ItemTarget>(null);
  useOpenParam((id) => itemRepo.get(id), setTarget);
  const [params, setParams] = useSearchParams();
  const toast = useUiStore((s) => s.toast);
  const moduleStates = useModuleStates();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const close = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  /** Sends names to the shopping list and confirms once the list has stored them. */
  const requestRestock = (names: string[]) => {
    const send = async () => {
      for (const name of names) await bus.emit('shopping.requested', { name });
      void toast(
        names.length === 1 ? t.pantry.restocked(names[0]!) : t.pantry.restockedMany(names.length),
      );
    };
    // Without the lists module nobody listens: say so and offer to switch it on (then the entries
    // are sent right away) instead of pretending.
    if (moduleStates?.lists !== true) return offerEnableModule('lists', t.pantry.shoppingOff, send);
    // Confirm only after the shopping list has stored the items: wait for the services (the app
    // renders before they run), then for the handlers.
    void whenServicesSettled().then(send);
  };
  const low = (items ?? []).filter(needsRestock);

  /** One piece used: when that takes the stock down to its minimum the item goes on the shopping list by itself. */
  const consume = (i: NonNullable<typeof items>[number]) => {
    const next = Math.max(0, i.count - 1);
    void changeWithUndo(() => itemRepo.update(i.id, { count: next }));
    if (autoRestock && moduleStates?.lists === true && crossedMinimum(i, next))
      void whenServicesSettled()
        .then(() => bus.emit('shopping.requested', { name: i.name }))
        .then(() => toast(t.pantry.autoRestocked(i.name)));
  };

  /** A scanned number: the item that has it gets one more, an unknown number starts a new item with it. */
  const onCode = (code: string) => {
    setScanning(false);
    const known = findByEan(items ?? [], code);
    if (known) {
      void changeWithUndo(
        () => itemRepo.update(known.id, { count: Math.min(9999, known.count + 1) }),
        t.pantry.scan.added(known.name),
      );
    } else setTarget({ draft: true, ean: code });
  };

  const counts = useMemo(() => {
    const out = Object.fromEntries(
      PLACES.map((p) => [p, { items: 0, expired: 0, soon: 0, low: 0 }]),
    ) as ShelfCounts;
    for (const i of items ?? []) {
      const c = out[i.place];
      c.items += 1;
      const state = expiryState(i, day, soonDays);
      if (state === 'expired') c.expired += 1;
      else if (state === 'soon') c.soon += 1;
      if (needsRestock(i)) c.low += 1;
    }
    return out;
  }, [items, day, soonDays]);

  const shown = useMemo(
    () => sortItems(applyFilter(items ?? [], filter, day, soonDays), day, soonDays),
    [items, filter, day, soonDays],
  );

  const expiryLine = (i: NonNullable<typeof items>[number]) => expiryText(i, day, soonDays);

  return (
    <>
      <PageHeader title={t.pantry.title}>
        <AdvancedToggle moduleId="pantry" />
        <PageAction short={t.pantry.meta.quickAdd} onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.pantry.add}
        </PageAction>
        {/* Scan and "restock all" are occasional: they sit in the ⋯ menu, one primary stays visible. */}
        <StartDataMenu
          moduleId="pantry"
          items={[
            ...(low.length >= 2
              ? [
                  {
                    id: 'restock-all',
                    label: t.pantry.restockAll(low.length),
                    onSelect: () => requestRestock(low.map((i) => i.name)),
                  },
                ]
              : []),
            { id: 'scan', label: t.pantry.scan.open, onSelect: () => setScanning(true) },
          ]}
        />
      </PageHeader>
      <PantryHead counts={counts} />
      <NowStrip modules={['pantry']} />{' '}
      <div className={lamp.filters}>
        <Segmented
          label={t.pantry.filter}
          value={filter}
          options={[
            { value: 'all' as const, label: t.pantry.filters.all },
            { value: 'expiring' as const, label: t.pantry.filters.expiring },
            { value: 'restock' as const, label: t.pantry.filters.restock },
          ]}
          onChange={setFilter}
        />
      </div>
      {items && items.length === 0 ? (
        <EmptyState
          title={t.pantry.empty}
          testId="pantry-empty"
          motif={<SignatureMark id="shelf" size={64} />}
        />
      ) : null}
      {items && items.length > 0 && shown.length === 0 ? (
        <p className={styles.lead}>{t.pantry.noMatch}</p>
      ) : null}
      {PLACES.map((place) => {
        const group = shown.filter((i) => i.place === place);
        if (group.length === 0) return null;
        return (
          <section
            key={place}
            id={`pantry-place-${place}`}
            aria-label={t.pantry.places[place]}
            className={styles.section}
          >
            <h2>{t.pantry.places[place]}</h2>
            <ItemList label={t.pantry.places[place]} layout="grid">
              {group.map((i) => {
                const state = expiryState(i, day, soonDays);
                const text = expiryLine(i);
                const restockable = needsRestock(i);
                return (
                  <ItemRow
                    key={i.id}
                    className={lamp.label}
                    signatureBlock="pantry-label"
                    title={i.name}
                    meta={
                      <span className={lamp.meta}>
                        {/* The lamp stays with the words it stands for (never alone on a line). */}
                        {state !== 'none' && text ? (
                          <span className={lamp.state}>
                            <span className={lamp.dot} data-state={state} aria-hidden="true" />
                            {state === 'ok' ? (
                              text
                            ) : (
                              <Badge tone={state === 'expired' ? 'danger' : 'warning'}>
                                {text}
                              </Badge>
                            )}
                          </span>
                        ) : null}
                        {restockable ? <Badge>{t.pantry.lowStock}</Badge> : null}
                      </span>
                    }
                    onOpen={() => setTarget(i)}
                    onSwipeRight={restockable ? () => requestRestock([i.name]) : undefined}
                    swipeRightLabel={t.pantry.restock}
                    end={
                      <span className={lamp.endCol}>
                        <span className={lamp.controls}>
                          {/* Fixed slot: every tile's end column has the same width, cart or not. */}
                          {restockable ? (
                            <IconButton
                              label={t.pantry.restockOne(i.name)}
                              onClick={() => requestRestock([i.name])}
                            >
                              <Icon name="cart" size={18} />
                            </IconButton>
                          ) : (
                            <span className={lamp.slot} aria-hidden="true" />
                          )}
                          <span className={lamp.stepper} role="group" aria-label={t.pantry.amount}>
                            <IconButton label={t.pantry.minus(i.name)} onClick={() => consume(i)}>
                              <Icon name="minus" size={16} />
                            </IconButton>
                            {/* The amount sits between − and + (mono); a unit stays with it. */}
                            <span className={lamp.count}>
                              {i.unit ? `${i.count} ${i.unit}` : i.count}
                            </span>
                            <IconButton
                              label={t.pantry.plus(i.name)}
                              onClick={() =>
                                void changeWithUndo(() =>
                                  itemRepo.update(i.id, { count: Math.min(9999, i.count + 1) }),
                                )
                              }
                            >
                              <Icon name="plus" size={16} />
                            </IconButton>
                          </span>
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </ItemList>
          </section>
        );
      })}
      <ScanDialog open={scanning} onClose={() => setScanning(false)} onCode={onCode} />
      <ItemEditor target={openTarget} onClose={close} />
    </>
  );
}
