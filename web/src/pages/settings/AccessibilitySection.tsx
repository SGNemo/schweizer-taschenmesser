import { Link } from 'react-router';
import { settingsPath } from '@/core/settings/registry/paths';
import {
  MOTIONS,
  TEXT_SIZES,
  useUiStore,
  type MotionChoice,
  type TextSizeChoice,
} from '@/stores/ui';
import { t } from '@/strings';
import { tSettings4 } from '@/strings.settings4';
import { Segmented, SettingRow, SettingsGroup, Switch } from '@/ui';

/**
 * Settings → Barrierefreiheit: the settings that make reading, seeing, movement and attention easier,
 * bundled. Text size, motion and the reading aid can be changed right here; they are the same values
 * as in Appearance (one store, no copy), the rest links to where it lives.
 */
export function AccessibilitySection() {
  const a = tSettings4.use().accessibility;
  const textSize = useUiStore((s) => s.textSize);
  const setTextSize = useUiStore((s) => s.setTextSize);
  const motion = useUiStore((s) => s.motion);
  const setMotion = useUiStore((s) => s.setMotion);
  const readAid = useUiStore((s) => s.readAid);
  const setReadAid = useUiStore((s) => s.setReadAid);
  const toastStay = useUiStore((s) => s.toastStay);
  const setToastStay = useUiStore((s) => s.setToastStay);
  return (
    <SettingsGroup id="accessibility" title={a.title} description={a.description}>
      <SettingRow id="accessibility--textSize" label={a.textSize}>
        <Segmented<TextSizeChoice>
          label={a.textSize}
          value={textSize}
          options={TEXT_SIZES.map((v) => ({ value: v, label: t.settings.textSizeOptions[v] }))}
          onChange={setTextSize}
        />
      </SettingRow>
      <SettingRow id="accessibility--motion" label={a.motion}>
        <Segmented<MotionChoice>
          label={a.motion}
          value={motion}
          options={MOTIONS.map((v) => ({ value: v, label: a.motionOptions[v] }))}
          onChange={setMotion}
        />
      </SettingRow>
      <SettingRow id="accessibility--readAid" label={a.readAid}>
        <Switch label={a.readAid} labelHidden checked={readAid} onChange={setReadAid} />
      </SettingRow>
      <SettingRow id="accessibility--toastStay" label={a.toastStay} description={a.toastStayHint}>
        <Switch label={a.toastStay} labelHidden checked={toastStay} onChange={setToastStay} />
      </SettingRow>
      <SettingRow id="accessibility--colors" label={a.colors} description={a.colorsHint}>
        <Link to={settingsPath('darstellung', 'appearance', 'color')}>{a.change}</Link>
      </SettingRow>
      <SettingRow id="accessibility--spacing" label={a.spacing} description={a.spacingHint}>
        <Link to={settingsPath('darstellung', 'appearance', 'leading')}>{a.change}</Link>
      </SettingRow>
    </SettingsGroup>
  );
}
