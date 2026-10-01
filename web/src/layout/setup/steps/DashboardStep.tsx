import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { SetupStepProps } from '@/core/setup/types';
import {
  mergeOrder,
  moveKey,
  orderWidgets,
  saveLayout,
  toggleHidden,
  useHomeLayout,
  widgetKey,
  type HomeLayout,
} from '@/home/layout';
import { widgetsOf } from '@/home/AutoWidget';
import { t } from '@/strings';
import { Icon, Switch } from '@/ui';

const s = t.setup.steps.dashboard;

interface Row {
  key: string;
  title: string;
}

function SortableRow({
  row,
  hidden,
  onToggle,
}: {
  row: Row;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: row.key });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        minHeight: 44,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={s.drag(row.title)}
        style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0, color: 'inherit' }}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={18} />
      </button>
      <Switch label={s.hide(row.title)} checked={!hidden} onChange={onToggle} />
    </li>
  );
}

/** Widget visibility and order of the active modules as a local draft; written on "Weiter". */
export default function DashboardStep({ registerCommit }: SetupStepProps) {
  const states = useModuleStates();
  const saved = useHomeLayout();
  const [draft, setDraft] = useState<HomeLayout | undefined>();
  const layout = draft ?? saved;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rows = useMemo<Row[]>(
    () =>
      availableManifests()
        .filter((m) => states?.[m.id])
        .flatMap((m) =>
          widgetsOf(m).map((w) => ({ key: widgetKey(m.id, w.id), title: `${m.name}: ${w.title}` })),
        ),
    [states],
  );

  useEffect(() => {
    registerCommit(draft ? () => saveLayout(draft) : null);
    return () => registerCommit(null);
  }, [registerCommit, draft]);

  if (!layout || !states) return null;
  if (rows.length === 0) return <p>{s.empty}</p>;
  const ordered = orderWidgets(rows, layout);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!layout || !over || active.id === over.id) return;
    const keys = moveKey(
      ordered.map((r) => r.key),
      String(active.id),
      String(over.id),
    );
    setDraft({ ...layout, order: mergeOrder(keys, layout) });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: s.instructions } }}
    >
      <SortableContext items={ordered.map((r) => r.key)} strategy={verticalListSortingStrategy}>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 'var(--space-2)',
          }}
        >
          {ordered.map((row) => (
            <SortableRow
              key={row.key}
              row={row}
              hidden={layout.hidden.includes(row.key)}
              onToggle={() => setDraft({ ...layout, hidden: toggleHidden(layout, row.key) })}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
