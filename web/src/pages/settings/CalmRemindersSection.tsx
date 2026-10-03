import {
  MAX_PER_HOUR,
  STAGE_OPTIONS,
  useFocusSettings,
  type FocusSettings,
} from '@/core/settings/focus';
import { t } from '@/strings';
import { Chip, Chips, Segmented, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

type BoolKey = {
  [K in keyof FocusSettings]: FocusSettings[K] extends boolean ? K : never;
}[keyof FocusSettings];

/** Settings → Benachrichtigungen → "Ruhige Erinnerungen": quiet hours, limit, stages, digest (synced scope `focus`). */
export function CalmRemindersSection() {
  const [v, patch] = useFocusSettings();
  const s = t.focus.reminders;
  const toggle = (key: BoolKey, label: string, hint: string) => (
    <SettingRow id={`calm-reminders--${key}`} label={label} description={hint}>
      <Switch
        label={label}
        labelHidden
        checked={v[key]}
        onChange={(x) => void patch({ [key]: x })}
      />
    </SettingRow>
  );
  const time = (key: 'quietFrom' | 'quietTo' | 'todoDigestTime', label: string) => (
    <TextField
      label={label}
      type="time"
      value={v[key]}
      onChange={(e) => {
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) void patch({ [key]: e.target.value });
      }}
    />
  );
  return (
    <SettingsGroup id="calm-reminders" title={s.title} description={s.description}>
      {toggle('inAppPrompt', s.inAppPrompt, s.inAppPromptHint)}
      {toggle('quietHours', s.quietHours, s.quietHoursHint)}
      {v.quietHours ? (
        <SettingRow id="calm-reminders--quietTimes" label={s.quietTimes}>
          <div className={styles.timePair}>
            {time('quietFrom', s.from)}
            {time('quietTo', s.to)}
          </div>
        </SettingRow>
      ) : null}
      <SettingRow
        id="calm-reminders--maxPerHour"
        label={s.maxPerHour}
        description={s.maxPerHourHint}
      >
        <Segmented<string>
          label={s.maxPerHour}
          value={String(v.maxPerHour)}
          options={MAX_PER_HOUR.map((n) => ({
            value: String(n),
            label: n === 0 ? s.noLimit : String(n),
          }))}
          onChange={(x) => void patch({ maxPerHour: Number(x) })}
        />
      </SettingRow>
      {toggle('staggered', s.staggered, s.staggeredHint)}
      {v.staggered ? (
        <SettingRow id="calm-reminders--stages" label={s.stages}>
          <Chips label={s.stages}>
            {STAGE_OPTIONS.map((m) => (
              <Chip
                key={m}
                label={s.stageLabel(m)}
                selected={v.stages.includes(m)}
                onClick={() =>
                  void patch({
                    stages: v.stages.includes(m)
                      ? v.stages.filter((x) => x !== m)
                      : [...v.stages, m].sort((a, b) => b - a).slice(0, 5),
                  })
                }
              />
            ))}
          </Chips>
        </SettingRow>
      ) : null}
      {toggle('followUp', s.followUp, s.followUpHint)}
      {toggle('todoDigest', s.todoDigest, s.todoDigestHint)}
      {v.todoDigest ? (
        <SettingRow id="calm-reminders--digestTime" label={s.digestTime}>
          {time('todoDigestTime', s.digestTime)}
        </SettingRow>
      ) : null}
    </SettingsGroup>
  );
}
