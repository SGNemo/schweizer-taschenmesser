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
import { Link, useLocation, useNavigate } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { lazyComponent } from '@/core/modules/lazy';
import { isWidgetVisible, widgetMaturity } from './maturity';
import { availableManifests } from '@/core/modules/available';
import { allManifests } from '@/core/modules/registry';
import type { Maturity, WidgetDef, WidgetSize, WidgetVariant } from '@/core/modules/types';
import { moduleSettingsPath } from '@/pages/settings/useSections';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tCockpit } from '@/strings.cockpit';
import { enterCockpit } from '@/layout/useCockpit';
import { HOME_VIEWS, useUiStore } from '@/stores/ui';
import { SignatureMark } from '@/ui/identity';
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
import { CockpitStats } from './CockpitStats';
import { OverviewHead } from './OverviewHead';
import { ResumeCard } from './ResumeCard';
import { usePackedGrid } from './masonry';

import styles from './Home.module.css';
import {
  COCKPIT_SCOPE,
  DEFAULT_LAYOUT,
  HOME_SCOPE,
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
  /** Frame shape: the widget's own variant, else the module's identity (`identity.widget`). */
  variant: WidgetVariant;
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
        variant: w.variant ?? m.identity.widget,
        key,
        Component: componentFor(key, w.component),
      };
    }),
  );

/** Key of the "Jetzt wichtig" strip in the layout's hidden list. */
const ATTENTION_KEY = 'core:attention';
/** Key of the "Heute · Morgen · diese Woche" block in the layout's hidden list. */
const AGENDA_KEY = 'core:agenda';

const SIZE_CLASS: Record<WidgetSize, string> = { s: styles.s!, m: styles.m!, l: styles.l! };

/**
 * The overview. With `cockpit` it is the cockpit's widget wall: own layout scope, no greeting,
 * cards or weather line, optional dense grid and large figures (`CockpitStats`).
 */
export function Home({ cockpit = false }: { cockpit?: boolean }) {
  const scope = cockpit ? COCKPIT_SCOPE : HOME_SCOPE;
  const states = useModuleStates();
  const tx = tCockpit.use();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const saved = useHomeLayout(scope);
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
  // The cards are drawn only once the saved layout is read: before that the default order (and cards the person
  // has hidden) would show for a moment and then jump. What depends on "are there cards at all" (the head's tools,
  // the hint for an overview without cards) keeps using `entries`, so nothing of it flashes in the meantime.
  const layoutRead = saved !== undefined;
  const ordered = useMemo(
    () => (layoutRead ? orderWidgets(entries, layout) : []),
    [entries, layout, layoutRead],
  );
  const homeView = useUiStore((s) => s.homeView);
  const setHomeView = useUiStore((s) => s.setHomeView);
  const calm = homeView === 'calm' && !editing && !cockpit;
  const hiddenByUser = ordered.filter((e) => layout.hidden.includes(e.key));
  // Keys the calm view may show; a Heute card the user hid lets the month card stand in.
  const available = ordered.filter((e) => !layout.hidden.includes(e.key)).map((e) => e.key);
  const shown = editing
    ? ordered
    : ordered.filter(
        (e) => !layout.hidden.includes(e.key) && (!calm || isCalmVisible(e.key, layout, available)),
      );
  const folded = calm ? ordered.length - hiddenByUser.length - shown.length : 0;
  // Packed (no holes) except while editing: reordering picks targets by position, so there the grid keeps the
  // saved order on plain rows.
  const gridRef = usePackedGrid<HTMLDivElement>(shown.map((e) => e.key).join('|'), !editing);

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
    void updateLayout({ order: mergeOrder(keys, layout) }, scope);
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

  const editTools =
    entries.length > 0 && editing ? (
      <>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          <Icon name="eye" size={18} />
          {t.homeEdit.widgets}
        </Button>
        <Button variant="secondary" onClick={() => setResetOpen(true)}>
          {t.homeEdit.reset}
        </Button>
      </>
    ) : null;

  return (
    <>
      {cockpit ? (
        editing ? (
          <div className={styles.cockpitTools} data-testid="cockpit-edit-tools">
            {editTools}
            <Button variant="primary" onClick={() => setEditing(false)} aria-pressed>
              <Icon name="check" size={18} />
              {t.homeEdit.done}
            </Button>
          </div>
        ) : null
      ) : (
        <OverviewHead
          weather={!!states?.weather}
          tools={
            entries.length > 0 ? (
              <>
                {editTools}
                {editing ? null : (
                  <Button
                    variant="ghost"
                    onClick={() => enterCockpit((to) => void navigate(to), pathname)}
                    data-testid="cockpit-enter"
                  >
                    <Icon name="maximize" size={18} />
                    {tx.enter}
                  </Button>
                )}
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
                {editing ? (
                  <Button variant="primary" onClick={() => setEditing(false)} aria-pressed>
                    <Icon name="check" size={18} />
                    {t.homeEdit.done}
                  </Button>
                ) : (
                  <IconButton
                    label={t.homeEdit.customize}
                    aria-pressed={false}
                    onClick={() => setEditing(true)}
                  >
                    <Icon name="edit" size={18} />
                  </IconButton>
                )}
              </>
            ) : null
          }
        />
      )}

      {cockpit ? null : (
        <>
          <WelcomeCard />
          <ChecklistCard />
          {!editing ? <ResumeCard /> : null}
        </>
      )}
      {cockpit && !editing && layout.stats ? <CockpitStats /> : null}
      {!editing && !layout.hidden.includes(ATTENTION_KEY) ? <AttentionStrip /> : null}
      {!editing && !layout.hidden.includes(AGENDA_KEY) ? <AgendaBlock /> : null}

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
            <div
              ref={gridRef}
              className={[
                styles.grid,
                editing ? styles.editing : '',
                cockpit ? styles.cockpit : '',
                cockpit && layout.dense ? styles.dense : '',
                calm && shown.length === 1 ? styles.single : '',
              ].join(' ')}
              data-testid={cockpit ? 'cockpit-grid' : 'home-grid'}
            >
              {shown.map((e) => (
                <SortableWidget
                  key={e.key}
                  entry={e}
                  editing={editing}
                  size={effectiveSize(e, e.key, layout)}
                  hidden={layout.hidden.includes(e.key)}
                  pinned={layout.pinned.includes(e.key)}
                  onTogglePinned={() => void updateLayout(togglePinned(layout, e.key), scope)}
                  onToggleHidden={() =>
                    void updateLayout({ hidden: toggleHidden(layout, e.key) }, scope)
                  }
                  onSize={(size) =>
                    void updateLayout(
                      { sizes: withSize(layout, e.key, size, e.defaultSize) },
                      scope,
                    )
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
          {cockpit ? (
            <>
              <li>
                <Switch
                  label={tx.dense}
                  hint={tx.denseHint}
                  checked={!!layout.dense}
                  onChange={(dense) => void updateLayout({ dense }, scope)}
                />
              </li>
              <li>
                <Switch
                  label={tx.stats}
                  hint={tx.statsHint}
                  checked={!!layout.stats}
                  onChange={(stats) => void updateLayout({ stats }, scope)}
                />
              </li>
            </>
          ) : null}
          <li>
            <Switch
              label={t.home.agenda.title}
              checked={!layout.hidden.includes(AGENDA_KEY)}
              onChange={() =>
                void updateLayout({ hidden: toggleHidden(layout, AGENDA_KEY) }, scope)
              }
            />
          </li>
          <li>
            <Switch
              label={t.attention.title}
              hint={t.attention.hint}
              checked={!layout.hidden.includes(ATTENTION_KEY)}
              onChange={() =>
                void updateLayout({ hidden: toggleHidden(layout, ATTENTION_KEY) }, scope)
              }
            />
          </li>
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
                onChange={() => void updateLayout({ hidden: toggleHidden(layout, e.key) }, scope)}
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
                void resetLayout(scope);
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
      data-hue={manifest?.identity.hue}
      data-widget={manifest ? entry.variant : undefined}
      data-area={manifest?.area}
    >
      <Card>
        <div className={styles.head}>
          {manifest ? (
            <span className={styles.chip} aria-hidden="true">
              <Icon name={manifest.icon} size={16} />
            </span>
          ) : null}
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
          {/* N05: the head signature as a small line mark, same place in every widget variant – the widget is
              told apart by form, not only by colour or title. Decoration only. */}
          {manifest && manifest.identity.signature !== 'none' ? (
            <span className={styles.mark} aria-hidden="true" data-testid="signature-mark">
              <SignatureMark id={manifest.identity.signature} size={22} />
            </span>
          ) : null}
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
