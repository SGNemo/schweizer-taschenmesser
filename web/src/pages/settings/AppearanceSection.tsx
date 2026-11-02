import { usePaletteStore } from '@/core/supporter/palette';
import { useSupporter } from '@/core/supporter';
import { t } from '@/strings';
import {
  ACCENTS,
  COLOR_MODES,
  DENSITIES,
  MODULE_COLOR_MODES,
  HOME_VIEWS,
  MOTIONS,
  SIDEBARS,
  useUiStore,
  type AccentChoice,
  type ColorMode,
  type DensityChoice,
  type HomeViewChoice,
  type LeadingChoice,
  type ModuleColorMode,
  type MotionChoice,
  type SidebarChoice,
  type TextSizeChoice,
  type ThemeChoice,
} from '@/stores/ui';
import { getPlatform } from '@/core/platform';
import { tCockpit } from '@/strings.cockpit';
import { tIdentity } from '@/strings.identity';
import { Segmented, SelectField, SettingRow, SettingsGroup, Switch } from '@/ui';
import { FoldedGroup } from './FoldedGroup';
import { PaletteRows } from './PaletteRows';

const THEMES = [
  {
    value: 'system',
    get label() {
      return t.settings.themeSystem;
    },
  },
  {
    value: 'light',
    get label() {
      return t.settings.themeLight;
    },
  },
  {
    value: 'dark',
    get label() {
      return t.settings.themeDark;
    },
  },
] as const;

const THEME_LABELS: Record<ThemeChoice, () => string> = {
  system: () => t.settings.themeSystem,
  light: () => t.settings.themeLight,
  dark: () => t.settings.themeDark,
};

/** Device-local look: theme, accent, text size, density, sidebar (stores/ui.ts, localStorage). */
export function AppearanceSection() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const accent = useUiStore((s) => s.accent);
  const setAccent = useUiStore((s) => s.setAccent);
  const textSize = useUiStore((s) => s.textSize);
  const setTextSize = useUiStore((s) => s.setTextSize);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const leading = useUiStore((s) => s.leading);
  const setLeading = useUiStore((s) => s.setLeading);
  const motion = useUiStore((s) => s.motion);
  const setMotion = useUiStore((s) => s.setMotion);
  const homeView = useUiStore((s) => s.homeView);
  const setHomeView = useUiStore((s) => s.setHomeView);
  const sidebar = useUiStore((s) => s.sidebar);
  const setSidebar = useUiStore((s) => s.setSidebar);
  const colorMode = useUiStore((s) => s.colorMode);
  const setColorMode = useUiStore((s) => s.setColorMode);
  const moduleColors = useUiStore((s) => s.moduleColors);
  const setModuleColors = useUiStore((s) => s.setModuleColors);
  const ti = tIdentity.use();
  const cockpitStart = useUiStore((s) => s.cockpitStart);
  const setCockpitStart = useUiStore((s) => s.setCockpitStart);
  const cockpitAwake = useUiStore((s) => s.cockpitAwake);
  const setCockpitAwake = useUiStore((s) => s.setCockpitAwake);
  const tx = tCockpit.use();
  const r = t.settings.rows;
  const { tier } = useSupporter();
  const chosenPalette = usePaletteStore((p) => p.chosen);
  const previewPalette = usePaletteStore((p) => p.preview);
  const g = t.settings.appearanceGroups;
  const shownPalette = previewPalette ?? (tier !== 'none' ? chosenPalette : null);
  const paletteOn = (previewPalette ?? (tier !== 'none' ? chosenPalette : null)) !== null;
  return (
    <SettingsGroup id="appearance" title={t.settings.appearance}>
      <FoldedGroup id="theme" title={g.theme} current={[THEME_LABELS[theme]()]}>
        <SettingRow id="appearance--theme" label={t.settings.theme} description={r.themeHint}>
          <Segmented<ThemeChoice>
            label={t.settings.theme}
            value={theme}
            options={THEMES}
            onChange={setTheme}
          />
        </SettingRow>
      </FoldedGroup>
      <FoldedGroup
        id="colors"
        title={g.colors}
        current={[
          t.settings.accentOptions[accent],
          shownPalette ? t.supporter.palette.names[shownPalette] : t.supporter.palette.standard,
          t.settings.colorOptions[colorMode],
          `${ti.moduleColors}: ${ti.options[moduleColors]}`,
        ]}
      >
        <SettingRow
          id="appearance--accent"
          label={t.settings.accent}
          description={paletteOn ? t.supporter.palette.accentFollows : r.accentHint}
        >
          <SelectField
            label={t.settings.accent}
            labelHidden
            disabled={paletteOn}
            value={accent}
            onChange={(e) => setAccent(e.target.value as AccentChoice)}
          >
            {ACCENTS.map((a) => (
              <option key={a} value={a}>
                {t.settings.accentOptions[a]}
              </option>
            ))}
          </SelectField>
        </SettingRow>
        <PaletteRows />
        <SettingRow
          id="appearance--color"
          label={t.settings.color}
          description={t.settings.colorHint}
        >
          <Segmented<ColorMode>
            label={t.settings.color}
            value={colorMode}
            options={COLOR_MODES.map((v) => ({ value: v, label: t.settings.colorOptions[v] }))}
            onChange={setColorMode}
          />
        </SettingRow>
        <SettingRow
          id="appearance--moduleColors"
          label={ti.moduleColors}
          description={ti.moduleColorsHint}
        >
          <Segmented<ModuleColorMode>
            label={ti.moduleColors}
            value={moduleColors}
            options={MODULE_COLOR_MODES.map((v) => ({ value: v, label: ti.options[v] }))}
            onChange={setModuleColors}
          />
        </SettingRow>
      </FoldedGroup>
      <FoldedGroup
        id="text"
        title={g.text}
        current={[
          t.settings.textSizeOptions[textSize],
          t.settings.leadingOptions[leading],
          t.settings.densityOptions[density],
        ]}
      >
        <SettingRow
          id="appearance--textSize"
          label={t.settings.textSize}
          description={r.textSizeHint}
        >
          <Segmented<TextSizeChoice>
            label={t.settings.textSize}
            value={textSize}
            options={(['small', 'normal', 'large', 'xlarge'] as const).map((v) => ({
              value: v,
              label: t.settings.textSizeOptions[v],
            }))}
            onChange={setTextSize}
          />
        </SettingRow>
        <SettingRow id="appearance--leading" label={t.settings.leading} description={r.leadingHint}>
          <Segmented<LeadingChoice>
            label={t.settings.leading}
            value={leading}
            options={(['compact', 'normal', 'airy'] as const).map((v) => ({
              value: v,
              label: t.settings.leadingOptions[v],
            }))}
            onChange={setLeading}
          />
        </SettingRow>
        <SettingRow id="appearance--density" label={t.settings.density} description={r.densityHint}>
          <Segmented<DensityChoice>
            label={t.settings.density}
            value={density}
            options={DENSITIES.map((v) => ({ value: v, label: t.settings.densityOptions[v] }))}
            onChange={setDensity}
          />
        </SettingRow>
      </FoldedGroup>
      <FoldedGroup id="motion" title={g.motion} current={[t.settings.motionOptions[motion]]}>
        <SettingRow id="appearance--motion" label={r.motion} description={r.motionHint}>
          <Segmented<MotionChoice>
            label={r.motion}
            value={motion}
            options={MOTIONS.map((v) => ({ value: v, label: t.settings.motionOptions[v] }))}
            onChange={setMotion}
          />
        </SettingRow>
      </FoldedGroup>
      <FoldedGroup
        id="other"
        title={g.other}
        current={[t.settings.sidebarOptions[sidebar], t.settings.homeViewOptions[homeView]]}
      >
        <SettingRow id="appearance--sidebar" label={t.settings.sidebar} description={r.sidebarHint}>
          <Segmented<SidebarChoice>
            label={t.settings.sidebar}
            value={sidebar}
            options={SIDEBARS.map((v) => ({ value: v, label: t.settings.sidebarOptions[v] }))}
            onChange={setSidebar}
          />
        </SettingRow>
        <SettingRow
          id="appearance--homeView"
          label={t.settings.homeView}
          description={r.homeViewHint}
        >
          <Segmented<HomeViewChoice>
            label={t.settings.homeView}
            value={homeView}
            options={HOME_VIEWS.map((v) => ({ value: v, label: t.settings.homeViewOptions[v] }))}
            onChange={setHomeView}
          />
        </SettingRow>
        <SettingRow id="appearance--cockpitStart" label={tx.startTitle} description={tx.startHint}>
          <Switch
            label={tx.startTitle}
            labelHidden
            checked={cockpitStart}
            onChange={setCockpitStart}
          />
        </SettingRow>
        {getPlatform().kind === 'android' ? (
          <SettingRow
            id="appearance--cockpitAwake"
            label={tx.awakeTitle}
            description={tx.awakeHint}
          >
            <Switch
              label={tx.awakeTitle}
              labelHidden
              checked={cockpitAwake}
              onChange={setCockpitAwake}
            />
          </SettingRow>
        ) : null}
      </FoldedGroup>
    </SettingsGroup>
  );
}
