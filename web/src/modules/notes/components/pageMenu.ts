import type { RowMenuItem } from '@/ui';
import { t } from '@/strings';
import type { Stored } from '@/core/db/types';
import type { Note } from '../schema';

export interface PageMenuActions {
  onTogglePin: (page: Stored<Note>) => void;
  onMove: (page: Stored<Note>) => void;
  onDelete: (page: Stored<Note>) => void;
}

/**
 * The "⋯" menu of one notes page (the row in the list): pin and move first, delete last and apart. It is a plain list,
 * so a further entry (planner package 3: "In den Plan") is one more item before `delete` – no layout change; the menu
 * grows downwards and opens upwards near the bottom bar on its own.
 */
export function pageMenuItems(page: Stored<Note>, a: PageMenuActions): RowMenuItem[] {
  return [
    {
      id: 'pin',
      label: page.pinned ? t.notes.unpin : t.notes.pin,
      onSelect: () => a.onTogglePin(page),
    },
    { id: 'move', label: t.notes.moveTo, onSelect: () => a.onMove(page) },
    // New page actions go here (before delete).
    { id: 'delete', label: t.actions.delete, danger: true, onSelect: () => a.onDelete(page) },
  ];
}
