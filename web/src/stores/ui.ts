import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';
const THEME_KEY = 'tm-theme';

function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: ThemeChoice): void {
  const el = document.documentElement;
  if (theme === 'system') delete el.dataset.theme;
  else el.dataset.theme = theme;
}

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface UiState {
  theme: ThemeChoice;
  setTheme(theme: ThemeChoice): void;
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;
  quickAddOpen: boolean;
  setQuickAddOpen(open: boolean): void;
  dashboardEditing: boolean;
  setDashboardEditing(editing: boolean): void;
  toasts: Toast[];
  toast(message: string, action?: Toast['action']): number;
  dismissToast(id: number): void;
}

let toastId = 0;

/** UI-only state. Persistent data lives in Dexie, never here. */
export const useUiStore = create<UiState>((set) => ({
  theme: readTheme(),
  setTheme(theme) {
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be blocked; theme still applies for this session.
    }
    applyTheme(theme);
    set({ theme });
  },
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  dashboardEditing: false,
  setDashboardEditing: (dashboardEditing) => set({ dashboardEditing }),
  toasts: [],
  toast(message, action) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, action }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
