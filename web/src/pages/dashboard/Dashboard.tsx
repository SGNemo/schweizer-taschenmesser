import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
import { Suspense, useMemo } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { lazyComponent } from '@/core/modules/lazy';
import { availableManifests } from '@/core/modules/available';
import type { WidgetDef } from '@/core/modules/types';
import { setSettings, useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, EmptyState, Icon, IconButton } from '@/ui';
import styles from './Dashboard.module.css';
import {
  DASHBOARD_SCOPE,
  dashboardLayoutSchema,
  DEFAULT_LAYOUT,
  mergeOrder,
  moveKey,
  orderWidgets,
  toggleHidden,
  widgetKey,
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
    m.widgets.map((w) => {
      const key = widgetKey(m.id, w.id);
      return { ...w, moduleId: m.id, key, Component: componentFor(key, w.component) };
    }),
  );

const SIZE_CLASS = { s: '', m: styles.m, l: styles.l } as const;

export function Dashboard() {
  const states = useModuleStates();
  const [saved] = useSettings(DASHBOARD_SCOPE, dashboardLayoutSchema, DEFAULT_LAYOUT);
  const editing = useUiStore((s) => s.dashboardEditing);
  const setEditing = useUiStore((s) => s.setDashboardEditing);

  const entries = useMemo(() => allEntries().filter((e) => states?.[e.moduleId]), [states]);
  const layout = saved ?? DEFAULT_LAYOUT;
  const ordered = useMemo(() => orderWidgets(entries, layout), [entries, layout]);
  const shown = editing ? ordered : ordered.filter((e) => !layout.hidden.includes(e.key));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const keys = moveKey(
      ordered.map((e) => e.key),
      String(active.id),
      String(over.id),
    );
    void setSettings(DASHBOARD_SCOPE, { order: mergeOrder(keys, layout) });
  }

  const title = (id: string | number) => ordered.find((e) => e.key === id)?.title ?? String(id);
  const position = (id: string | number, overId?: string | number) =>
    ordered.findIndex((e) => e.key === (overId ?? id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.dashboardEdit.picked(title(active.id)),
    onDragOver: ({ active, over }) =>
      over ? t.dashboardEdit.moved(title(active.id), position(active.id, over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t.dashboardEdit.dropped(title(active.id), position(active.id, over.id)) : undefined,
    onDragCancel: () => t.dashboardEdit.cancelled,
  };

  return (
    <>
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <h1>{t.dashboard.title}</h1>
        {entries.length > 0 ? (
          <Button
            variant={editing ? 'primary' : 'secondary'}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
          >
            <Icon name={editing ? 'check' : 'edit'} size={18} />
            {editing ? t.dashboardEdit.done : t.dashboardEdit.customize}
          </Button>
        ) : null}
      </div>

      {states && availableManifests().every((m) => !states[m.id]) ? (
        <EmptyState icon="grid" title={t.dashboard.emptyTitle}>
          <p>{t.dashboard.emptyText}</p>
          <Link to="/library">{t.dashboard.toLibrary}</Link>
        </EmptyState>
      ) : states && entries.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{t.dashboard.noWidgets}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t.dashboardEdit.instructions },
          }}
        >
          <SortableContext items={shown.map((e) => e.key)} strategy={rectSortingStrategy}>
            <div className={`${styles.grid} ${editing ? styles.editing : ''}`}>
              {shown.map((e) => (
                <SortableWidget
                  key={e.key}
                  entry={e}
                  editing={editing}
                  hidden={layout.hidden.includes(e.key)}
                  onToggleHidden={() =>
                    void setSettings(DASHBOARD_SCOPE, { hidden: toggleHidden(layout, e.key) })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

interface WidgetProps {
  entry: Entry;
  editing: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
}

function SortableWidget({ entry, editing, hidden, onToggleHidden }: WidgetProps) {
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
        SIZE_CLASS[entry.size],
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
              <IconButton
                label={hidden ? t.dashboardEdit.show : t.dashboardEdit.hide}
                onClick={onToggleHidden}
              >
                <Icon name={hidden ? 'eyeOff' : 'eye'} />
              </IconButton>
              <IconButton
                label={t.dashboardEdit.handle(entry.title)}
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
          <p className={styles.hint}>{t.dashboardEdit.hidden}</p>
        ) : (
          <Suspense fallback={<p role="status">…</p>}>
            <Widget />
          </Suspense>
        )}
      </Card>
    </div>
  );
}
