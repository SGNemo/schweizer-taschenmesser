import { t } from '@/strings';
import {
  ACCENTS,
  COLOR_MODES,
  DENSITIES,
  HOME_VIEWS,
  MOTIONS,
  SIDEBARS,
  useUiStore,
  type AccentChoice,
  type ColorMode,
  type DensityChoice,
  type HomeViewChoice,
  type LeadingChoice,
  type MotionChoice,
  type SidebarChoice,
  type TextSizeChoice,
  type ThemeChoice,
} from '@/stores/ui';
import { Segmented, SelectField, SettingRow, SettingsGroup } from '@/ui';

const THEMES = [
  { value: 'system', label: t.settings.themeSystem },
  { value: 'light', label: t.settings.themeLight },
  { value: 'dark', label: t.settings.themeDark },
] as const;

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
  const r = t.settings.rows;
  return (
    <SettingsGroup id="appearance" title={t.settings.appearance}>
      <SettingRow id="appearance--theme" label={t.settings.theme} description={r.themeHint}>
        <Segmented<ThemeChoice>
          label={t.settings.theme}
          value={theme}
          options={THEMES}
          onChange={setTheme}
        />
      </SettingRow>
      <SettingRow id="appearance--accent" label={t.settings.accent} description={r.accentHint}>
        <SelectField
          label={t.settings.accent}
          labelHidden
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
      <SettingRow id="appearance--sidebar" label={t.settings.sidebar} description={r.sidebarHint}>
        <Segmented<SidebarChoice>
          label={t.settings.sidebar}
          value={sidebar}
          options={SIDEBARS.map((v) => ({ value: v, label: t.settings.sidebarOptions[v] }))}
          onChange={setSidebar}
        />
      </SettingRow>
      <SettingRow id="appearance--motion" label={r.motion} description={r.motionHint}>
        <Segmented<MotionChoice>
          label={r.motion}
          value={motion}
          options={MOTIONS.map((v) => ({ value: v, label: t.settings.motionOptions[v] }))}
          onChange={setMotion}
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
    </SettingsGroup>
  );
}
