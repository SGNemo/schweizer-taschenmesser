import {
  MAX_PER_HOUR,
  PROMPT_SECONDS,
  REPEAT_MAX,
  REPEAT_MINUTES,
  STAGE_OPTIONS,
  useFocusSettings,
  type FocusSettings,
} from '@/core/settings/focus';
import type { ReactNode } from 'react';
import { t } from '@/strings';
import { Chip, Chips, Segmented, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import { FoldedGroup } from './FoldedGroup';
import styles from './settings.module.css';

type BoolKey = {
  [K in keyof FocusSettings]: FocusSettings[K] extends boolean ? K : never;
}[keyof FocusSettings];

/**
 * Settings → Benachrichtigungen → "Ruhige Erinnerungen": quiet hours, limit, stages, digest (synced
 * scope `focus`), as six folded lines with the current choice ("Ruhezeit: 22:00–07:00 · Ändern").
 */
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
  const group = (id: string, title: string, current: string[], body: ReactNode) => (
    <FoldedGroup section="calm-reminders" id={id} title={title} current={current}>
      {body}
    </FoldedGroup>
  );
  return (
    <SettingsGroup id="calm-reminders" title={s.title} description={s.description}>
      {group(
        'inApp',
        s.inAppGroup,
        v.inAppPrompt
          ? [
              s.on,
              s.inAppPositions[v.inAppPosition],
              s.inAppSecondsOptions[String(v.inAppSeconds) as keyof typeof s.inAppSecondsOptions],
            ]
          : [s.off],
        <>
          {toggle('inAppPrompt', s.inAppPrompt, s.inAppPromptHint)}
          {v.inAppPrompt ? (
            <>
              <SettingRow id="calm-reminders--inAppPosition" label={s.inAppPosition}>
                <Segmented<'top' | 'bottom'>
                  label={s.inAppPosition}
                  value={v.inAppPosition}
                  options={(['top', 'bottom'] as const).map((p) => ({
                    value: p,
                    label: s.inAppPositions[p],
                  }))}
                  onChange={(inAppPosition) => void patch({ inAppPosition })}
                />
              </SettingRow>
              <SettingRow id="calm-reminders--inAppSeconds" label={s.inAppSeconds}>
                <Segmented<string>
                  label={s.inAppSeconds}
                  value={String(v.inAppSeconds)}
                  options={PROMPT_SECONDS.map((n) => ({
                    value: String(n),
                    label: s.inAppSecondsOptions[String(n) as keyof typeof s.inAppSecondsOptions],
                  }))}
                  onChange={(x) => void patch({ inAppSeconds: Number(x) })}
                />
              </SettingRow>
            </>
          ) : null}
        </>,
      )}
      {group(
        'quiet',
        s.quietHours,
        v.quietHours ? [`${v.quietFrom}–${v.quietTo}`] : [s.off],
        <>
          {toggle('quietHours', s.quietHours, s.quietHoursHint)}
          {v.quietHours ? (
            <SettingRow id="calm-reminders--quietTimes" label={s.quietTimes}>
              <div className={styles.timePair}>
                {time('quietFrom', s.from)}
                {time('quietTo', s.to)}
              </div>
            </SettingRow>
          ) : null}
        </>,
      )}
      {group(
        'limit',
        s.maxPerHour,
        [v.maxPerHour === 0 ? s.noLimit : String(v.maxPerHour)],
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
        </SettingRow>,
      )}
      {group(
        'staggered',
        s.staggered,
        v.staggered ? v.stages.map((m) => s.stageLabel(m)) : [s.off],
        <>
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
        </>,
      )}
      {group(
        'followUp',
        s.followUp,
        v.followUp
          ? [s.repeatEveryOption(v.repeatMinutes), s.repeatMaxOption(v.repeatMax)]
          : [s.off],
        <>
          {toggle('followUp', s.followUp, s.followUpHint)}
          {v.followUp ? (
            <>
              <SettingRow id="calm-reminders--repeatMinutes" label={s.repeatEvery}>
                <Segmented<string>
                  label={s.repeatEvery}
                  value={String(v.repeatMinutes)}
                  options={REPEAT_MINUTES.map((n) => ({
                    value: String(n),
                    label: s.repeatEveryOption(n),
                  }))}
                  onChange={(x) => void patch({ repeatMinutes: Number(x) })}
                />
              </SettingRow>
              <SettingRow
                id="calm-reminders--repeatMax"
                label={s.repeatMax}
                description={s.repeatMaxHint}
              >
                <Segmented<string>
                  label={s.repeatMax}
                  value={String(v.repeatMax)}
                  options={REPEAT_MAX.map((n) => ({
                    value: String(n),
                    label: s.repeatMaxOption(n),
                  }))}
                  onChange={(x) => void patch({ repeatMax: Number(x) })}
                />
              </SettingRow>
            </>
          ) : null}
        </>,
      )}
      {group(
        'digest',
        s.todoDigest,
        v.todoDigest ? [v.todoDigestTime] : [s.off],
        <>
          {toggle('todoDigest', s.todoDigest, s.todoDigestHint)}
          {v.todoDigest ? (
            <SettingRow id="calm-reminders--digestTime" label={s.digestTime}>
              {time('todoDigestTime', s.digestTime)}
            </SettingRow>
          ) : null}
        </>,
      )}
    </SettingsGroup>
  );
}
