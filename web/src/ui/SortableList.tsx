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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { t } from '@/strings';
import { IconButton } from './Button';
import { Icon } from './icons';
import styles from './SortableList.module.css';

/** Moves `activeId` to the position of `overId`. */
export function moveId(ids: string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}

/**
 * Vertical list that can be reordered by drag and drop: mouse (small drag distance), touch (long
 * press on the handle, so scrolling never moves anything) and keyboard (space, arrows, space).
 * The caller keeps its own non-drag way (e.g. up/down buttons) and gets the new id order.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
}: {
  items: T[];
  getId: (item: T) => string;
  /** Name of an item for the handle and the screen reader announcements. */
  getLabel: (item: T) => string;
  onReorder: (ids: string[]) => void;
  /** Renders one row; put `handle` wherever the grip should sit. */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(moveId(ids, String(active.id), String(over.id)));
  }

  const label = (id: string | number) => {
    const item = items.find((i) => getId(i) === id);
    return item ? getLabel(item) : String(id);
  };
  const position = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.homeEdit.picked(label(active.id)),
    onDragOver: ({ active, over }) =>
      over ? t.homeEdit.moved(label(active.id), position(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t.homeEdit.dropped(label(active.id), position(over.id)) : undefined,
    onDragCancel: () => t.homeEdit.cancelled,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t.homeEdit.instructions },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={getId(item)} id={getId(item)} label={getLabel(item)}>
            {(handle) => renderItem(item, i, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = (
    <IconButton
      label={t.homeEdit.handle(label)}
      className={styles.handle}
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
    >
      <Icon name="grip" />
    </IconButton>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? styles.dragging : undefined}
    >
      {children(handle)}
    </div>
  );
}
