/**
 * Quick switches: the few device-local appearance choices people change often, offered as one tap in
 * Settings and as direct commands in the palette. An allow-list on purpose: nothing security related
 * (vault, auto-lock, keys, tokens, update channel, disk) can ever be listed here.
 */
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import {
  COLOR_MODES,
  DENSITIES,
  HOME_VIEWS,
  useUiStore,
  type ColorMode,
  type DensityChoice,
  type HomeViewChoice,
  type ThemeChoice,
} from '@/stores/ui';
import { settingsPath } from './registry/paths';

export interface QuickOption {
  value: string;
  label: string;
}

export interface QuickSetting {
  id: 'theme' | 'density' | 'readAid' | 'color' | 'homeView';
  /** Registry row this switch mirrors (`/settings/<category>#<section>--<field>`). */
  path: string;
  label(): string;
  options(): QuickOption[];
  read(): string;
  write(value: string): void;
}

const ui = () => useUiStore.getState();

export const QUICK_SETTINGS: readonly QuickSetting[] = [
  {
    id: 'theme',
    path: settingsPath('darstellung', 'appearance', 'theme'),
    label: () => t.settings.theme,
    options: () => [
      { value: 'system', label: t.settings.themeSystem },
      { value: 'light', label: t.settings.themeLight },
      { value: 'dark', label: t.settings.themeDark },
    ],
    read: () => ui().theme,
    write: (v) => ui().setTheme(v as ThemeChoice),
  },
  {
    id: 'density',
    path: settingsPath('darstellung', 'appearance', 'density'),
    label: () => t.settings.density,
    options: () => DENSITIES.map((v) => ({ value: v, label: t.settings.densityOptions[v] })),
    read: () => ui().density,
    write: (v) => ui().setDensity(v as DensityChoice),
  },
  {
    id: 'readAid',
    path: settingsPath('darstellung', 'reading', 'aid'),
    label: () => tComfort.get().quick.readAid,
    options: () => [
      { value: 'on', label: tComfort.get().quick.on },
      { value: 'off', label: tComfort.get().quick.off },
    ],
    read: () => (ui().readAid ? 'on' : 'off'),
    write: (v) => ui().setReadAid(v === 'on'),
  },
  {
    id: 'color',
    path: settingsPath('darstellung', 'appearance', 'color'),
    label: () => t.settings.color,
    options: () => COLOR_MODES.map((v) => ({ value: v, label: t.settings.colorOptions[v] })),
    read: () => ui().colorMode,
    write: (v) => ui().setColorMode(v as ColorMode),
  },
  {
    id: 'homeView',
    path: settingsPath('darstellung', 'appearance', 'homeView'),
    label: () => t.settings.homeView,
    options: () => HOME_VIEWS.map((v) => ({ value: v, label: t.settings.homeViewOptions[v] })),
    read: () => ui().homeView,
    write: (v) => ui().setHomeView(v as HomeViewChoice),
  },
];

/** The text of one option, or the raw value when it is unknown. */
export function optionLabel(setting: QuickSetting, value: string): string {
  return setting.options().find((o) => o.value === value)?.label ?? value;
}

/**
 * Sets a quick switch and confirms with a toast whose action puts the previous value back
 * (settings are not part of the undo journal, so the inverse is kept right here).
 */
export function applyQuick(setting: QuickSetting, value: string): void {
  const before = setting.read();
  if (before === value) return;
  setting.write(value);
  ui().toast(tComfort.get().quick.changed(setting.label(), optionLabel(setting, value)), {
    label: t.ui.undo,
    run: () => setting.write(before),
  });
}
