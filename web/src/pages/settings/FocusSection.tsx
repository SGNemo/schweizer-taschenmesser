import {
  FOCUS_MINUTES,
  PLAN_LIMITS,
  useFocusSettings,
  type FocusSettings,
} from '@/core/settings/focus';
import { t } from '@/strings';
import { Segmented, SettingRow, SettingsGroup, Switch } from '@/ui';

type BoolKey = {
  [K in keyof FocusSettings]: FocusSettings[K] extends boolean ? K : never;
}[keyof FocusSettings];

/** Settings → Darstellung → "Fokus & Aufmerksamkeit": one switch per aid (synced scope `focus`). */
export function FocusSection() {
  const [values, patch] = useFocusSettings();
  const s = t.focus.settings;
  const toggle = (id: string, key: BoolKey, label: string, hint: string) => (
    <SettingRow id={`focus--${key}`} label={label} description={hint} key={id}>
      <Switch
        label={label}
        labelHidden
        checked={values[key]}
        onChange={(v) => void patch({ [key]: v })}
      />
    </SettingRow>
  );
  return (
    <SettingsGroup id="focus" title={s.title} description={s.description}>
      {toggle('nextOne', 'nextOne', s.nextOne, s.nextOneHint)}
      {toggle('dayPlan', 'dayPlan', s.dayPlan, s.dayPlanHint)}
      <SettingRow id="focus--planLimit" label={s.planLimit} description={s.planLimitHint}>
        <Segmented<string>
          label={s.planLimit}
          value={String(values.planLimit)}
          options={PLAN_LIMITS.map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => void patch({ planLimit: Number(v) })}
        />
      </SettingRow>
      {toggle('calmAttention', 'calmAttention', s.calmAttention, s.calmAttentionHint)}
      {toggle('timeToNext', 'timeToNext', s.timeToNext, s.timeToNextHint)}
      <SettingRow id="focus--focusMinutes" label={s.focusMinutes} description={s.focusMinutesHint}>
        <Segmented<string>
          label={s.focusMinutes}
          value={String(values.focusMinutes)}
          options={FOCUS_MINUTES.map((n) => ({
            value: String(n),
            label: s.focusMinutesOption(n),
          }))}
          onChange={(v) => void patch({ focusMinutes: Number(v) })}
        />
      </SettingRow>
      {toggle('focusSound', 'focusSound', s.focusSound, s.focusSoundHint)}
      {toggle('focusIndicator', 'focusIndicator', s.focusIndicator, s.focusIndicatorHint)}
    </SettingsGroup>
  );
}
