import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useFormatLocale } from '@/core/i18n/format';
import { useSettings } from '@/core/settings/settings';
import { localZone } from '@/core/time/placeSearch';
import { useMinuteNow } from '@/core/time/useMinuteNow';
import { changeWithUndo, undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  PageAction,
  PageHeader,
  RowMenu,
  SortableList,
  useOpenParam,
} from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { AddPlaceDialog } from '../components/AddPlaceDialog';
import { RenameDialog } from '../components/RenameDialog';
import { MAX_PLACES, listPlaces, placeRepo, reorderPlaces, type StoredPlace } from '../repo';
import { settings, type ClockPrefs } from '../settings';
import { formatZoneTime, placeLine } from '../view';
import styles from '../clock.module.css';

/**
 * The places with their time, big; the local time above as the reference. Sorting by drag (handle) or the ⋯ menu,
 * renaming and removing (with undo). The time changes once a minute, nothing moves in between.
 */
export default function ClockPage() {
  useFormatLocale();
  const at = useMinuteNow();
  const here = localZone();
  const places = useLiveQuery(listPlaces, []);
  const [prefs] = useSettings('module.clock', settings.schema, settings.defaults);
  const showZone = (prefs as ClockPrefs | undefined)?.showZone ?? true;
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<StoredPlace | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  useOpenParam((id) => placeRepo.get(id), setRenaming);

  // `?new=1` (Quick-Add, widget, palette) opens the search; closing drops the parameter.
  const addOpen = adding || !!params.get('new');
  const closeAdd = () => {
    setAdding(false);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };

  const list = places ?? [];
  const full = list.length >= MAX_PLACES;
  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((p) => p.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id!);
    void changeWithUndo(() => reorderPlaces(ids), t.clock.moved);
  };
  const remove = (p: StoredPlace) =>
    void undoableWithToast(p.label, t.clock.removed(p.label), () => placeRepo.remove(p.id));

  return (
    <>
      <PageHeader title={t.clock.title}>
        <PageAction
          short={t.nav.plusThings.place}
          variant={places && list.length === 0 ? 'secondary' : 'primary'}
          onClick={() => setAdding(true)}
          disabled={full}
        >
          <Icon name="plus" size={18} />
          {t.clock.add}
        </PageAction>
      </PageHeader>
      <HeroSlot area="figure">
        <HeroFigure
          label={t.clock.here}
          value={formatZoneTime(at, here)}
          detail={t.clock.hereLine(here)}
          testId="clock-here"
        />
      </HeroSlot>

      {places && list.length === 0 ? (
        <EmptyState title={t.clock.empty} testId="clock-empty">
          <Button variant="primary" onClick={() => setAdding(true)}>
            {t.clock.addFirst}
          </Button>
        </EmptyState>
      ) : null}

      {list.length > 0 ? (
        <section aria-label={t.clock.list}>
          {full ? <p className={styles.note}>{t.clock.full(MAX_PLACES)}</p> : null}
          {/* SortableList wraps each row in a div, so the list semantics are roles. */}
          <div className={styles.list} role="list" data-testid="clock-list">
            <SortableList
              items={list}
              getId={(p) => p.id}
              getLabel={(p) => p.label}
              onReorder={(ids) => void changeWithUndo(() => reorderPlaces(ids), t.clock.moved)}
              renderItem={(p, index, handle) => {
                const line = placeLine(at, p.zone, here);
                return (
                  <div className={styles.row} role="listitem" data-testid="clock-place">
                    {handle}
                    <div
                      className={styles.body}
                      aria-label={t.clock.aria(
                        p.label,
                        line.shown,
                        `${line.dayPart}, ${line.context}`,
                      )}
                      role="group"
                    >
                      <span className={styles.name}>{p.label}</span>
                      {showZone ? <span className={styles.zone}>{p.zone}</span> : null}
                      <span className={styles.context}>
                        <Icon name={line.night ? 'moon' : 'sun'} size={16} />
                        {line.dayPart} · {line.context}
                      </span>
                    </div>
                    <time className={styles.time} dateTime={`${line.date}T${line.time}`}>
                      {line.shown}
                    </time>
                    <RowMenu
                      label={t.clock.menu.label(p.label)}
                      open={menu === p.id}
                      onOpenChange={(o) => setMenu(o ? p.id : null)}
                      items={[
                        {
                          id: 'rename',
                          label: t.clock.menu.rename,
                          onSelect: () => setRenaming(p),
                        },
                        ...(index > 0
                          ? [{ id: 'up', label: t.clock.menu.up, onSelect: () => move(index, -1) }]
                          : []),
                        ...(index < list.length - 1
                          ? [
                              {
                                id: 'down',
                                label: t.clock.menu.down,
                                onSelect: () => move(index, 1),
                              },
                            ]
                          : []),
                        {
                          id: 'remove',
                          label: t.clock.menu.remove,
                          danger: true,
                          onSelect: () => remove(p),
                        },
                      ]}
                    />
                  </div>
                );
              }}
            />
          </div>
        </section>
      ) : null}

      <AddPlaceDialog open={addOpen && !full} onClose={closeAdd} />
      <RenameDialog
        key={renaming?.id ?? 'none'}
        place={renaming}
        onClose={() => setRenaming(null)}
      />
    </>
  );
}
