import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { bus } from '@/core/events';
import { useModuleStates } from '@/core/modules/activation';
import { useSettings } from '@/core/settings/settings';
import { formatDay, today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { t } from '@/strings';
import {
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
} from '@/ui';
import { ItemEditor, type ItemTarget } from '../components/ItemEditor';
import { applyFilter, daysLeft, expiryState, needsRestock, sortItems, type Filter } from '../logic';
import { itemRepo } from '../repo';
import { PLACES } from '../schema';
import { settings as moduleSettings, settingsSchema } from '../settings';
import styles from '@/pages/Page.module.css';

export default function PantryPage() {
  const items = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [prefs] = useSettings('module.pantry', settingsSchema, moduleSettings.defaults as never);
  const soonDays = (prefs as { soonDays?: number } | undefined)?.soonDays ?? 3;
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<ItemTarget>(null);
  const [params, setParams] = useSearchParams();
  const toast = useUiStore((s) => s.toast);
  const moduleStates = useModuleStates();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const close = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

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
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.pantry.add}
        </Button>
      </PageHeader>
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
                        {t.pantry.countOf(i.count)}
                        {state === 'ok' && text ? ` · ${text}` : ''}
                      </>
                    }
                    onOpen={() => setTarget(i)}
                    end={
                      <span className={patternStyles.hstackTight}>
                        {state === 'expired' || state === 'soon' ? (
                          <Badge tone="accent">{text}</Badge>
                        ) : null}
                        {needsRestock(i) ? <Badge>{t.pantry.lowStock}</Badge> : null}
                        <IconButton
                          label={t.pantry.minus(i.name)}
                          onClick={() =>
                            void itemRepo.update(i.id, { count: Math.max(0, i.count - 1) })
                          }
                        >
                          <span aria-hidden="true">−</span>
                        </IconButton>
                        <IconButton
                          label={t.pantry.plus(i.name)}
                          onClick={() =>
                            void itemRepo.update(i.id, { count: Math.min(9999, i.count + 1) })
                          }
                        >
                          <Icon name="plus" size={16} />
                        </IconButton>
                      </span>
                    }
                  >
                    {needsRestock(i) ? (
                      <Button
                        onClick={() => {
                          // Without the shopping module nobody listens: say so instead of pretending.
                          if (moduleStates?.lists !== true) return toast(t.pantry.shoppingOff);
                          void bus.emit('shopping.requested', { name: i.name });
                          toast(t.pantry.restocked(i.name));
                        }}
                      >
                        {t.pantry.restock}
                      </Button>
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
