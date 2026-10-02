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

/** Device-local reading comfort (tokens.css `data-text-size`, `data-density`); defaults set no attribute. */
export const TEXT_SIZES = ['normal', 'large'] as const;
export type TextSizeChoice = (typeof TEXT_SIZES)[number];
export const DENSITIES = ['normal', 'compact'] as const;
export type DensityChoice = (typeof DENSITIES)[number];
const TEXT_SIZE_KEY = 'tm-text-size';
const DENSITY_KEY = 'tm-density';

function readChoice<T extends string>(key: string, values: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    return values.find((x) => x === v) ?? values[0]!;
  } catch {
    return values[0]!;
  }
}

function storeChoice(key: string, value: string, isDefault: boolean): void {
  try {
    if (isDefault) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the choice still applies for this session.
  }
}

export function applyTextSize(size: TextSizeChoice): void {
  const el = document.documentElement;
  if (size === 'normal') delete el.dataset.textSize;
  else el.dataset.textSize = size;
}

export function applyDensity(density: DensityChoice): void {
  const el = document.documentElement;
  if (density === 'normal') delete el.dataset.density;
  else el.dataset.density = density;
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
  textSize: TextSizeChoice;
  setTextSize(size: TextSizeChoice): void;
  density: DensityChoice;
  setDensity(density: DensityChoice): void;
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
  textSize: readChoice(TEXT_SIZE_KEY, TEXT_SIZES),
  setTextSize(textSize) {
    storeChoice(TEXT_SIZE_KEY, textSize, textSize === 'normal');
    applyTextSize(textSize);
    set({ textSize });
  },
  density: readChoice(DENSITY_KEY, DENSITIES),
  setDensity(density) {
    storeChoice(DENSITY_KEY, density, density === 'normal');
    applyDensity(density);
    set({ density });
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
