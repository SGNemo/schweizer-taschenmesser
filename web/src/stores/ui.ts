import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';
const THEME_KEY = 'tm-theme';

/** Accent colour of the app (tokens.css `data-accent`); orange is the default and sets no attribute. */
export const ACCENTS = ['orange', 'teal', 'coral', 'lagoon'] as const;
export type AccentChoice = (typeof ACCENTS)[number];
const ACCENT_KEY = 'tm-accent';

function readAccent(): AccentChoice {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return ACCENTS.find((a) => a === v) ?? 'orange';
  } catch {
    return 'orange';
  }
}

export function applyAccent(accent: AccentChoice): void {
  const el = document.documentElement;
  if (accent === 'orange') delete el.dataset.accent;
  else el.dataset.accent = accent;
}

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
  syncThemeColor(theme);
}

/**
 * Keeps the browser/PWA title bar in step with the chosen theme. `index.html` ships two
 * `theme-color` metas with `media` queries for the system preference; a forced theme sets both to
 * the page background of that theme, `system` restores the originals.
 */
function syncThemeColor(theme: ThemeChoice): void {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const meta of metas) {
    if (!meta.dataset.default) meta.dataset.default = meta.content;
    meta.content = theme === 'system' || !bg ? meta.dataset.default : bg;
  }
}

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface UiState {
  theme: ThemeChoice;
  setTheme(theme: ThemeChoice): void;
  accent: AccentChoice;
  setAccent(accent: AccentChoice): void;
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;
  quickAddOpen: boolean;
  setQuickAddOpen(open: boolean): void;
  /** The toolbar sheet and the tool shown in it (`null` = the tile grid). */
  toolsOpen: boolean;
  activeTool: string | null;
  openTools(toolId?: string | null): void;
  closeTools(): void;
  homeEditing: boolean;
  setHomeEditing(editing: boolean): void;
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
  accent: readAccent(),
  setAccent(accent) {
    try {
      if (accent === 'orange') localStorage.removeItem(ACCENT_KEY);
      else localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // Storage may be blocked; the accent still applies for this session.
    }
    applyAccent(accent);
    set({ accent });
  },
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  toolsOpen: false,
  activeTool: null,
  openTools: (toolId = null) => set({ toolsOpen: true, activeTool: toolId }),
  closeTools: () => set({ toolsOpen: false, activeTool: null }),
  homeEditing: false,
  setHomeEditing: (homeEditing) => set({ homeEditing }),
  toasts: [],
  toast(message, action) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, action }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
