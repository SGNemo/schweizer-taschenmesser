import { NowStrip } from '@/core/modules/NowStrip';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { offerEnableModule } from '@/core/modules/offerEnable';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { useSettings } from '@/core/settings/settings';
import { formatDay, today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { t } from '@/strings';
import {
  AdvancedToggle,
  Badge,
  Button,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  patternStyles,
  Segmented,
  useOpenParam,
} from '@/ui';
import { ItemEditor, type ItemTarget } from '../components/ItemEditor';
import {
  applyFilter,
  countLabel,
  crossedMinimum,
  daysLeft,
  expiryState,
  needsRestock,
  sortItems,
  type Filter,
} from '../logic';
import { ShelfSignature, type ShelfCounts } from '../components/ShelfSignature';
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

  const counts = useMemo(() => {
    const out = Object.fromEntries(PLACES.map((p) => [p, { items: 0, flagged: 0 }])) as ShelfCounts;
    for (const i of items ?? []) {
      out[i.place].items += 1;
      if (['expired', 'soon'].includes(expiryState(i, day, soonDays)) || needsRestock(i))
        out[i.place].flagged += 1;
    }
    return out;
  }, [items, day, soonDays]);

  const shown = useMemo(
    () => sortItems(applyFilter(items ?? [], filter, day, soonDays), day, soonDays),
    [items, filter, day, soonDays],
  );

  const expiryText = (i: NonNullable<typeof items>[number]) => {
    const d = daysLeft(i, day);
    if (d === undefined) return null;
    if (d < 0) return t.pantry.expired(d);
    if (d === 0) return t.pantry.today;
    if (d <= soonDays) return t.pantry.inDays(d);
    return t.pantry.until(formatDay(i.expires!, 'dd.MM.yyyy'));
  };

  return (
    <>
      <PageHeader title={t.pantry.title}>
        <AdvancedToggle moduleId="pantry" />
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.pantry.add}
        </Button>
      </PageHeader>
      <ShelfSignature counts={counts} />
      <NowStrip modules={['pantry']} />{' '}
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
      {low.length >= 2 ? (
        <p>
          <Button onClick={() => requestRestock(low.map((i) => i.name))}>
            {t.pantry.restockAll(low.length)}
          </Button>
        </p>
      ) : null}
      {items && items.length === 0 ? (
        <EmptyState title={t.pantry.empty}>
          <StartDataButton moduleId="pantry" />
        </EmptyState>
      ) : null}
      {items && items.length > 0 && shown.length === 0 ? (
        <p className={styles.lead}>{t.pantry.noMatch}</p>
      ) : null}
      {PLACES.map((place) => {
        const group = shown.filter((i) => i.place === place);
        if (group.length === 0) return null;
        return (
          <section key={place} aria-label={t.pantry.places[place]} className={styles.section}>
            <h2>{t.pantry.places[place]}</h2>
            <ItemList label={t.pantry.places[place]}>
              {group.map((i) => {
                const state = expiryState(i, day, soonDays);
                const text = expiryText(i);
                return (
                  <ItemRow
                    key={i.id}
                    title={i.name}
                    meta={
                      <>
                        <span className={lamp.dot} data-state={state} aria-hidden="true" />
                        {countLabel(i, t.pantry.countOf)}
                        {state === 'ok' && text ? ` · ${text}` : ''}
                      </>
                    }
                    onOpen={() => setTarget(i)}
                    end={
                      <span className={patternStyles.hstackTight}>
                        {state === 'expired' || state === 'soon' ? (
                          <Badge tone={state === 'expired' ? 'danger' : 'warning'}>{text}</Badge>
                        ) : null}
                        {needsRestock(i) ? <Badge>{t.pantry.lowStock}</Badge> : null}
                        <IconButton label={t.pantry.minus(i.name)} onClick={() => consume(i)}>
                          <span aria-hidden="true">−</span>
                        </IconButton>
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
                    }
                  >
                    {needsRestock(i) ? (
                      <Button onClick={() => requestRestock([i.name])}>{t.pantry.restock}</Button>
                    ) : null}
                  </ItemRow>
                );
              })}
            </ItemList>
          </section>
        );
      })}
      <ItemEditor target={openTarget} onClose={close} />
    </>
  );
}
