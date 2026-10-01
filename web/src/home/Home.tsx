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
import { availableManifests } from '@/core/modules/available';
import { allManifests } from '@/core/modules/registry';
import type { WidgetDef, WidgetSize } from '@/core/modules/types';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
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
  Skeleton,
  Switch,
} from '@/ui';
import { widgetsOf } from './AutoWidget';

import styles from './Home.module.css';
import {
  DEFAULT_LAYOUT,
  effectiveSize,
  mergeOrder,
  moveKey,
  orderWidgets,
  resetLayout,
  toggleHidden,
  updateLayout,
  useHomeLayout,
  widgetKey,
  withSize,
} from './layout';

interface Entry extends WidgetDef {
  key: string;
  moduleId: string;
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
      return { ...w, moduleId: m.id, key, Component: componentFor(key, w.component) };
    }),
  );

const SIZE_CLASS: Record<WidgetSize, string> = { s: '', m: styles.m!, l: styles.l! };

export function Home() {
  const states = useModuleStates();
  const saved = useHomeLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const editing = useUiStore((s) => s.homeEditing);
  const setEditing = useUiStore((s) => s.setHomeEditing);

  const entries = useMemo(() => allEntries().filter((e) => states?.[e.moduleId]), [states]);
  const layout = saved ?? DEFAULT_LAYOUT;
  const ordered = useMemo(() => orderWidgets(entries, layout), [entries, layout]);
  const shown = editing ? ordered : ordered.filter((e) => !layout.hidden.includes(e.key));

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

      {states && availableManifests().every((m) => !states[m.id]) ? (
        <EmptyState icon="grid" title={t.home.emptyTitle}>
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
          <SortableContext items={shown.map((e) => e.key)} strategy={rectSortingStrategy}>
            <div className={`${styles.grid} ${editing ? styles.editing : ''}`}>
              {shown.map((e) => (
                <SortableWidget
                  key={e.key}
                  entry={e}
                  editing={editing}
                  size={effectiveSize(e, e.key, layout)}
                  hidden={layout.hidden.includes(e.key)}
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

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t.homeEdit.widgetsTitle}
        variant="sheet"
      >
        <p className={styles.hint}>{t.homeEdit.widgetsNote}</p>
        {ordered.length === 0 ? <p>{t.homeEdit.widgetsNone}</p> : null}
        <ul className={patternStyles.plainList}>
          {ordered.map((e) => (
            <li key={e.key}>
              <Switch
                label={e.title}
                hint={allManifests.find((m) => m.id === e.moduleId)?.name}
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
  onToggleHidden: () => void;
  onSize: (size: WidgetSize) => void;
}

function SortableWidget({ entry, editing, size, hidden, onToggleHidden, onSize }: WidgetProps) {
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
          <h2 className={styles.title}>{entry.title}</h2>
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
          <Suspense fallback={<WidgetFallback />}>
            <Widget />
          </Suspense>
        )}
      </Card>
    </div>
  );
}
