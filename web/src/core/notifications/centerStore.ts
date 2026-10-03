import { create } from 'zustand';
import type { DueNotification } from '@/core/modules/types';

/** What the panel shows first: the list, the next open reminder or a random one. */
export type CenterMode = 'list' | 'next' | 'random';

interface CenterState {
  isOpen: boolean;
  mode: CenterMode;
  /** Open reminders (oldest first), kept fresh by `useOpenReminders`. */
  open: DueNotification[];
  setOpenList(open: DueNotification[]): void;
  openCenter(mode?: CenterMode): void;
  closeCenter(): void;
}

export const useCenterStore = create<CenterState>((set) => ({
  isOpen: false,
  mode: 'list',
  open: [],
  setOpenList: (open) => set({ open }),
  openCenter: (mode = 'list') => set({ isOpen: true, mode }),
  closeCenter: () => set({ isOpen: false }),
}));

/** For widgets and palette commands (modules may import core, not layout). */
export const openReminderCenter = (mode: CenterMode = 'list'): void =>
  useCenterStore.getState().openCenter(mode);
