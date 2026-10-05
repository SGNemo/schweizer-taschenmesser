import { create } from 'zustand';
import type { IconName } from '@/ui/icons';

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
export const TEXT_SIZES = ['normal', 'small', 'large', 'xlarge'] as const;
export type TextSizeChoice = (typeof TEXT_SIZES)[number];
/** Line spacing and in-app motion (tokens.css `data-leading`, `data-motion`); defaults set no attribute. */
export const LEADINGS = ['normal', 'compact', 'airy'] as const;
export type LeadingChoice = (typeof LEADINGS)[number];
export const MOTIONS = ['system', 'reduce'] as const;
export type MotionChoice = (typeof MOTIONS)[number];
/** "Alle Widgets" or the calm home view with only what starts the day (device-local). */
export const HOME_VIEWS = ['all', 'calm'] as const;
export type HomeViewChoice = (typeof HOME_VIEWS)[number];
export const DENSITIES = ['normal', 'compact'] as const;
export type DensityChoice = (typeof DENSITIES)[number];
export const SIDEBARS = ['wide', 'narrow'] as const;
export type SidebarChoice = (typeof SIDEBARS)[number];
/** Reading aid (ui/ReadableText): off by default; share of each word that is emphasised, style, scope. */
export const READ_SHARES = ['40', '30', '50'] as const;
export type ReadShare = (typeof READ_SHARES)[number];
export const READ_STYLES = ['soft', 'bold'] as const;
export type ReadStyle = (typeof READ_STYLES)[number];
/** `text` = running text only (notes, answers, help); `lists` = also list titles and teasers. */
export const READ_SCOPES = ['text', 'lists'] as const;
export type ReadScope = (typeof READ_SCOPES)[number];
/** `calm` keeps colour only for overdue and today (tokens.css `data-color`). */
export const COLOR_MODES = ['full', 'calm'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
const READ_AID_KEY = 'tm-read-aid';
const READ_SHARE_KEY = 'tm-read-share';
const READ_STYLE_KEY = 'tm-read-style';
const READ_SCOPE_KEY = 'tm-read-scope';
const READ_HINT_KEY = 'tm-read-hint';
const COLOR_MODE_KEY = 'tm-color';
const SIDEBAR_KEY = 'tm-sidebar';
const AREAS_CLOSED_KEY = 'tm-nav-closed';
const GROUPS_CLOSED_KEY = 'tm-groups-closed';
const TEXT_SIZE_KEY = 'tm-text-size';
const DENSITY_KEY = 'tm-density';
const LEADING_KEY = 'tm-leading';
const MOTION_KEY = 'tm-motion';
const HOME_VIEW_KEY = 'tm-home-view';

function readChoice<T extends string>(key: string, values: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    return values.find((x) => x === v) ?? values[0]!;
  } catch {
    return values[0]!;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
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

function readClosedAreas(key = AREAS_CLOSED_KEY): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function applyTextSize(size: TextSizeChoice): void {
  const el = document.documentElement;
  if (size === 'normal') delete el.dataset.textSize;
  else el.dataset.textSize = size;
}

export function applyLeading(leading: LeadingChoice): void {
  const el = document.documentElement;
  if (leading === 'normal') delete el.dataset.leading;
  else el.dataset.leading = leading;
}

export function applyMotion(motion: MotionChoice): void {
  const el = document.documentElement;
  if (motion === 'system') delete el.dataset.motion;
  else el.dataset.motion = motion;
}

export function applyDensity(density: DensityChoice): void {
  const el = document.documentElement;
  if (density === 'normal') delete el.dataset.density;
  else el.dataset.density = density;
}

export function applyReadStyle(style: ReadStyle): void {
  const el = document.documentElement;
  if (style === 'soft') delete el.dataset.readStyle;
  else el.dataset.readStyle = style;
}

export function applyColorMode(mode: ColorMode): void {
  const el = document.documentElement;
  if (mode === 'full') delete el.dataset.color;
  else el.dataset.color = mode;
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
  /** Optional leading icon (a check for confirmations). */
  icon?: IconName;
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
  leading: LeadingChoice;
  setLeading(leading: LeadingChoice): void;
  readAid: boolean;
  setReadAid(on: boolean): void;
  readShare: ReadShare;
  setReadShare(share: ReadShare): void;
  readStyle: ReadStyle;
  setReadStyle(style: ReadStyle): void;
  readScope: ReadScope;
  setReadScope(scope: ReadScope): void;
  /** True once the one-time hint about the reading aid was shown or dismissed (device-local). */
  readHintSeen: boolean;
  markReadHintSeen(): void;
  colorMode: ColorMode;
  setColorMode(mode: ColorMode): void;
  /** In-app switch for "less motion"; "system" follows the operating system. */
  motion: MotionChoice;
  setMotion(motion: MotionChoice): void;
  homeView: HomeViewChoice;
  setHomeView(view: HomeViewChoice): void;
  /** Desktop sidebar: wide (248 px) or rail (76 px); below 1200 px the rail is automatic. */
  sidebar: SidebarChoice;
  setSidebar(sidebar: SidebarChoice): void;
  /** Sidebar areas the user folded (device-local). */
  closedAreas: string[];
  toggleAreaOpen(area: string): void;
  /** Folded list groups as `<listId>:<groupId>` (device-local; see ui/GroupedList). */
  closedGroups: string[];
  toggleGroupOpen(key: string): void;
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;
  quickAddOpen: boolean;
  setQuickAddOpen(open: boolean): void;
  shortcutsOpen: boolean;
  setShortcutsOpen(open: boolean): void;
  /** The toolbar sheet and the tool shown in it (`null` = the tile grid). */
  toolsOpen: boolean;
  activeTool: string | null;
  openTools(toolId?: string | null): void;
  closeTools(): void;
  homeEditing: boolean;
  setHomeEditing(editing: boolean): void;
  toasts: Toast[];
  /** At most two toasts stack; a third pushes the oldest out. */
  toast(message: string, action?: Toast['action'], icon?: IconName): number;
  dismissToast(id: number): void;
}

let toastId = 0;
export const MAX_TOASTS = 2;

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
  leading: readChoice(LEADING_KEY, LEADINGS),
  setLeading(leading) {
    storeChoice(LEADING_KEY, leading, leading === 'normal');
    applyLeading(leading);
    set({ leading });
  },
  readAid: readFlag(READ_AID_KEY),
  setReadAid(readAid) {
    storeChoice(READ_AID_KEY, '1', !readAid);
    set({ readAid });
  },
  readShare: readChoice(READ_SHARE_KEY, READ_SHARES),
  setReadShare(readShare) {
    storeChoice(READ_SHARE_KEY, readShare, readShare === READ_SHARES[0]);
    set({ readShare });
  },
  readStyle: readChoice(READ_STYLE_KEY, READ_STYLES),
  setReadStyle(readStyle) {
    storeChoice(READ_STYLE_KEY, readStyle, readStyle === 'soft');
    applyReadStyle(readStyle);
    set({ readStyle });
  },
  readScope: readChoice(READ_SCOPE_KEY, READ_SCOPES),
  setReadScope(readScope) {
    storeChoice(READ_SCOPE_KEY, readScope, readScope === 'text');
    set({ readScope });
  },
  readHintSeen: readFlag(READ_HINT_KEY),
  markReadHintSeen() {
    storeChoice(READ_HINT_KEY, '1', false);
    set({ readHintSeen: true });
  },
  colorMode: readChoice(COLOR_MODE_KEY, COLOR_MODES),
  setColorMode(colorMode) {
    storeChoice(COLOR_MODE_KEY, colorMode, colorMode === 'full');
    applyColorMode(colorMode);
    set({ colorMode });
  },
  motion: readChoice(MOTION_KEY, MOTIONS),
  setMotion(motion) {
    storeChoice(MOTION_KEY, motion, motion === 'system');
    applyMotion(motion);
    set({ motion });
  },
  homeView: readChoice(HOME_VIEW_KEY, HOME_VIEWS),
  setHomeView(homeView) {
    storeChoice(HOME_VIEW_KEY, homeView, homeView === 'all');
    set({ homeView });
  },
  sidebar: readChoice(SIDEBAR_KEY, SIDEBARS),
  setSidebar(sidebar) {
    storeChoice(SIDEBAR_KEY, sidebar, sidebar === 'wide');
    set({ sidebar });
  },
  closedAreas: readClosedAreas(),
  toggleAreaOpen(area) {
    set((s) => {
      const closedAreas = s.closedAreas.includes(area)
        ? s.closedAreas.filter((a) => a !== area)
        : [...s.closedAreas, area];
      storeChoice(AREAS_CLOSED_KEY, JSON.stringify(closedAreas), closedAreas.length === 0);
      return { closedAreas };
    });
  },
  closedGroups: readClosedAreas(GROUPS_CLOSED_KEY),
  toggleGroupOpen(key) {
    set((s) => {
      const closedGroups = s.closedGroups.includes(key)
        ? s.closedGroups.filter((g) => g !== key)
        : [...s.closedGroups, key];
      storeChoice(GROUPS_CLOSED_KEY, JSON.stringify(closedGroups), closedGroups.length === 0);
      return { closedGroups };
    });
  },
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  toolsOpen: false,
  activeTool: null,
  openTools: (toolId = null) => set({ toolsOpen: true, activeTool: toolId }),
  closeTools: () => set({ toolsOpen: false, activeTool: null }),
  homeEditing: false,
  setHomeEditing: (homeEditing) => set({ homeEditing }),
  toasts: [],
  toast(message, action, icon) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, action, icon }].slice(-MAX_TOASTS) }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
