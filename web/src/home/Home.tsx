import { WidgetErrorBoundary } from '@/layout/WidgetErrorBoundary';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { lazyComponent } from '@/core/modules/lazy';
import { isWidgetVisible, widgetMaturity } from './maturity';
import { availableManifests } from '@/core/modules/available';
import { allManifests } from '@/core/modules/registry';
import type { Maturity, WidgetDef, WidgetSize } from '@/core/modules/types';
import { moduleSettingsPath } from '@/pages/settings/useSections';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { HOME_VIEWS, useUiStore } from '@/stores/ui';
import { SetupLink } from '@/layout/setup/SetupLink';
import { ChecklistCard } from '@/layout/setup/ChecklistCard';
import { WelcomeCard } from '@/layout/setup/WelcomeCard';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  patternStyles,
  Segmented,
  SettingsLink,
  Skeleton,
  Switch,
  WidgetSizeContext,
} from '@/ui';
import { widgetsOf } from './AutoWidget';
import { AgendaBlock } from './AgendaBlock';
import { AttentionStrip } from './AttentionStrip';
import { ResumeCard } from './ResumeCard';
import { NowPlayingLine } from './NowPlayingLine';
import { useNowPlayingAvailable } from './useNowPlaying';
import { tSpotify } from '@/strings.spotify';
import { WeatherLine } from './WeatherLine';

import styles from './Home.module.css';
import {
  DEFAULT_LAYOUT,
  effectiveSize,
  isCalmVisible,
  mergeOrder,
  moveKey,
  orderWidgets,
  resetLayout,
  toggleHidden,
  togglePinned,
  updateLayout,
  useHomeLayout,
  widgetKey,
  withoutFolded,
  withSize,
} from './layout';

interface Entry extends WidgetDef {
  key: string;
  moduleId: string;
  /** Module maturity tightened by the widget's own (`home/maturity.ts`); drives the badge. */
  effectiveMaturity: Maturity;
  Component: ReturnType<typeof lazyComponent>;
}

/** Lazy components are created once per widget, not per render. */
const componentCache = new Map<string, Entry['Component']>();
const componentFor = (key: string, load: WidgetDef['component']) => {
  let c = componentCache.get(key);
  if (!c) componentCache.set(key, (c = lazyComponent(load)));
  return c;
};

/** Widgets of the modules available on this platform (resolved after `initPlatform()`). */
const allEntries = (): Entry[] =>
  availableManifests().flatMap((m) =>
    widgetsOf(m).map((w) => {
      const key = widgetKey(m.id, w.id);
      return {
        ...w,
        to: w.to ?? m.routes?.[0]?.path,
        moduleId: m.id,
        effectiveMaturity: widgetMaturity(m.maturity, w),
        key,
        Component: componentFor(key, w.component),
      };
    }),
  );

/** Key of the "Jetzt wichtig" strip in the layout's hidden list. */
const ATTENTION_KEY = 'core:attention';
/** Key of the "Läuft gerade" widget in the layout's hidden list (shown by default once Spotify is connected). */
export const NOWPLAYING_KEY = 'core:nowplaying';
/** Key of the "Heute · Morgen · diese Woche" block in the layout's hidden list. */
const AGENDA_KEY = 'core:agenda';

const SIZE_CLASS: Record<WidgetSize, string> = { s: styles.s!, m: styles.m!, l: styles.l! };

export function Home() {
  const states = useModuleStates();
  const nowPlayingAvailable = useNowPlayingAvailable();
  const tSp = tSpotify.use();
  const saved = useHomeLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const editing = useUiStore((s) => s.homeEditing);
  const setEditing = useUiStore((s) => s.setHomeEditing);

  const layout = saved ?? DEFAULT_LAYOUT;
  const showPreview = useUiStore((s) => s.showPreview);
  // Widgets of enabled modules; a widget marked preview only with "In Arbeit anzeigen" or when pinned.
  const entries = useMemo(
    () =>
      withoutFolded(
        allEntries().filter(
          (e) =>
            states?.[e.moduleId] &&
            isWidgetVisible(e.key, e, { showPreview, pinned: layout.pinned }),
        ),
      ),
    [states, showPreview, layout.pinned],
  );
  const ordered = useMemo(() => orderWidgets(entries, layout), [entries, layout]);
  const homeView = useUiStore((s) => s.homeView);
  const setHomeView = useUiStore((s) => s.setHomeView);
  const calm = homeView === 'calm' && !editing;
  const hiddenByUser = ordered.filter((e) => layout.hidden.includes(e.key));
  const shown = editing
    ? ordered
    : ordered.filter(
        (e) => !layout.hidden.includes(e.key) && (!calm || isCalmVisible(e.key, layout)),
      );
  const folded = calm ? ordered.length - hiddenByUser.length - shown.length : 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long press on the handle on touch screens, so scrolling the page never moves a widget.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const keys = moveKey(
      ordered.map((e) => e.key),
      String(active.id),
      String(over.id),
    );
    void updateLayout({ order: mergeOrder(keys, layout) });
  }

  const title = (id: string | number) => ordered.find((e) => e.key === id)?.title ?? String(id);
  const position = (id: string | number, overId?: string | number) =>
    ordered.findIndex((e) => e.key === (overId ?? id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.homeEdit.picked(title(active.id)),
    onDragOver: ({ active, over }) =>
      over ? t.homeEdit.moved(title(active.id), position(active.id, over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t.homeEdit.dropped(title(active.id), position(active.id, over.id)) : undefined,
    onDragCancel: () => t.homeEdit.cancelled,
  };

  return (
    <>
      <PageHeader title={t.home.title}>
        {entries.length > 0 ? (
          <>
            {editing ? (
              <>
                <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                  <Icon name="eye" size={18} />
                  {t.homeEdit.widgets}
                </Button>
                <Button variant="secondary" onClick={() => setResetOpen(true)}>
                  {t.homeEdit.reset}
                </Button>
              </>
            ) : null}
            {editing ? null : (
              <Segmented
                label={t.settings.homeView}
                value={homeView}
                options={HOME_VIEWS.map((v) => ({
                  value: v,
                  label: t.settings.homeViewOptions[v],
                }))}
                onChange={setHomeView}
              />
            )}
            <Button
              variant={editing ? 'primary' : 'secondary'}
              onClick={() => setEditing(!editing)}
              aria-pressed={editing}
            >
              <Icon name={editing ? 'check' : 'edit'} size={18} />
              {editing ? t.homeEdit.done : t.homeEdit.customize}
            </Button>
          </>
        ) : null}
      </PageHeader>

      <WelcomeCard />
      <ChecklistCard />
      {!editing ? <ResumeCard /> : null}
      {!editing && !layout.hidden.includes(ATTENTION_KEY) ? <AttentionStrip /> : null}
      {!editing && !layout.hidden.includes(AGENDA_KEY) ? <AgendaBlock /> : null}
      {!editing ? <WeatherLine /> : null}
      {!editing && !layout.hidden.includes(NOWPLAYING_KEY) ? <NowPlayingLine /> : null}

      {states && availableManifests().every((m) => !states[m.id]) ? (
        <EmptyState title={t.home.emptyTitle}>
          <p>{t.home.emptyText}</p>
          <Link to="/library">{t.home.toLibrary}</Link>
          <SetupLink />
        </EmptyState>
      ) : states && entries.length === 0 ? (
        <p className={styles.hint}>{t.home.noWidgets}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t.homeEdit.instructions },
          }}
        >
          {editing ? <p className={styles.hint}>{t.homeEdit.pinNote}</p> : null}
          <SortableContext items={shown.map((e) => e.key)} strategy={rectSortingStrategy}>
            <div className={`${styles.grid} ${editing ? styles.editing : ''}`}>
              {shown.map((e) => (
                <SortableWidget
                  key={e.key}
                  entry={e}
                  editing={editing}
                  size={effectiveSize(e, e.key, layout)}
                  hidden={layout.hidden.includes(e.key)}
                  pinned={layout.pinned.includes(e.key)}
                  onTogglePinned={() => void updateLayout(togglePinned(layout, e.key))}
                  onToggleHidden={() => void updateLayout({ hidden: toggleHidden(layout, e.key) })}
                  onSize={(size) =>
                    void updateLayout({ sizes: withSize(layout, e.key, size, e.defaultSize) })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {calm && folded > 0 ? (
        <div className={styles.moreRow} data-testid="home-calm-more">
          <Button variant="secondary" onClick={() => setHomeView('all')}>
            {t.homeEdit.showMore(folded)}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t.homeEdit.pinStart}
          </Button>
        </div>
      ) : null}

      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.homeEdit.widgetsTitle}>
        <p className={styles.hint}>{t.homeEdit.widgetsNote}</p>
        {ordered.length === 0 ? <p>{t.homeEdit.widgetsNone}</p> : null}
        <ul className={patternStyles.plainList}>
          <li>
            <Switch
              label={t.home.agenda.title}
              checked={!layout.hidden.includes(AGENDA_KEY)}
              onChange={() => void updateLayout({ hidden: toggleHidden(layout, AGENDA_KEY) })}
            />
          </li>
          <li>
            <Switch
              label={t.attention.title}
              hint={t.attention.hint}
              checked={!layout.hidden.includes(ATTENTION_KEY)}
              onChange={() => void updateLayout({ hidden: toggleHidden(layout, ATTENTION_KEY) })}
            />
          </li>
          {nowPlayingAvailable ? (
            <li>
              <Switch
                label={tSp.widgetSwitch}
                hint={tSp.widgetHint}
                checked={!layout.hidden.includes(NOWPLAYING_KEY)}
                onChange={() => void updateLayout({ hidden: toggleHidden(layout, NOWPLAYING_KEY) })}
              />
            </li>
          ) : null}
          {ordered.map((e) => (
            <li key={e.key}>
              <Switch
                label={e.title}
                hint={[
                  allManifests.find((m) => m.id === e.moduleId)?.name,
                  e.effectiveMaturity === 'preview' ? t.settings.maturity.badge : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                checked={!layout.hidden.includes(e.key)}
                onChange={() => void updateLayout({ hidden: toggleHidden(layout, e.key) })}
              />
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t.homeEdit.resetTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              {t.homeEdit.cancel}
            </Button>
            <Button
              onClick={() => {
                void resetLayout();
                setResetOpen(false);
              }}
            >
              {t.homeEdit.resetConfirm}
            </Button>
          </>
        }
      >
        <p>{t.homeEdit.resetText}</p>
      </Dialog>
    </>
  );
}

function WidgetFallback() {
  return (
    <div role="status" aria-label="…">
      <Skeleton width="60%" height="1.25rem" />
    </div>
  );
}

interface WidgetProps {
  entry: Entry;
  editing: boolean;
  size: WidgetSize;
  hidden: boolean;
  pinned: boolean;
  onTogglePinned: () => void;
  onToggleHidden: () => void;
  onSize: (size: WidgetSize) => void;
}

function SortableWidget({
  entry,
  editing,
  size,
  hidden,
  pinned,
  onTogglePinned,
  onToggleHidden,
  onSize,
}: WidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.key,
    disabled: !editing,
  });
  const Widget = entry.Component;
  const manifest = availableManifests().find((m) => m.id === entry.moduleId);
  const settingsTo = manifest ? moduleSettingsPath(manifest) : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        styles.widget,
        SIZE_CLASS[size],
        hidden ? styles.hidden : '',
        isDragging ? styles.dragging : '',
      ].join(' ')}
      data-testid={`widget-${entry.key}`}
    >
      <Card>
        <div className={styles.head}>
          <h2 className={styles.title}>
            {entry.to && !editing ? (
              <Link to={entry.to} className={styles.titleLink}>
                {entry.title}
                <Icon name="chevronRight" size={16} />
              </Link>
            ) : (
              entry.title
            )}
          </h2>
          {!editing && settingsTo ? (
            <span className={styles.gear}>
              <SettingsLink to={settingsTo} label={tComfort.get().gear.module} />
            </span>
          ) : null}
          {editing ? (
            <>
              {entry.sizes.length > 1 ? (
                <Segmented
                  label={t.homeEdit.size(entry.title)}
                  value={size}
                  options={entry.sizes.map((z) => ({
                    value: z,
                    label: t.homeEdit.sizeOptions[z]!,
                  }))}
                  onChange={onSize}
                />
              ) : null}
              {pinned ? <span className={styles.pinnedTag}>{t.homeEdit.pinned}</span> : null}
              <IconButton
                label={pinned ? t.homeEdit.unpin(entry.title) : t.homeEdit.pin(entry.title)}
                aria-pressed={pinned}
                onClick={onTogglePinned}
              >
                <Icon name="pin" />
              </IconButton>
              <IconButton
                label={hidden ? t.homeEdit.show : t.homeEdit.hide}
                onClick={onToggleHidden}
              >
                <Icon name={hidden ? 'eyeOff' : 'eye'} />
              </IconButton>
              <IconButton
                label={t.homeEdit.handle(entry.title)}
                className={styles.handle}
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
              >
                <Icon name="grip" />
              </IconButton>
            </>
          ) : null}
        </div>
        {hidden && editing ? (
          <p className={styles.hint}>{t.homeEdit.hidden}</p>
        ) : (
          <WidgetErrorBoundary id={entry.key}>
            <Suspense fallback={<WidgetFallback />}>
              <WidgetSizeContext.Provider value={size}>
                <Widget />
              </WidgetSizeContext.Provider>
            </Suspense>
          </WidgetErrorBoundary>
        )}
      </Card>
    </div>
  );
}
