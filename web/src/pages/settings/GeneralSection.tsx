import { CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE } from '@/core/settings/core';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Segmented, SettingRow, SettingsGroup, TextField } from '@/ui';

const s = t.settings.general;
const WEEK_OPTIONS = [
  { value: 'mon', label: s.weekStartOptions.mon },
  { value: 'sun', label: s.weekStartOptions.sun },
] as const;

/** Name and week start (synced scope `core`); language, currency and formats are shown as fixed facts. */
export function GeneralSection() {
  const [values, patch] = useSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE);
  if (!values) return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <SettingsGroup id="general" title={s.title}>
      <SettingRow id="general--displayName" label={s.name} description={s.nameHint}>
        <TextField
          label={s.name}
          labelHidden
          defaultValue={values.displayName}
          maxLength={60}
          placeholder={s.namePlaceholder}
          autoComplete="off"
          onBlur={(e) => {
            if (e.target.value !== values.displayName) void patch({ displayName: e.target.value });
          }}
        />
      </SettingRow>
      <SettingRow id="general--weekStart" label={s.weekStart} description={s.weekStartHint}>
        <Segmented
          label={s.weekStart}
          value={values.weekStart}
          options={WEEK_OPTIONS}
          onChange={(weekStart) => void patch({ weekStart })}
        />
      </SettingRow>
      <SettingRow id="general--language" label={s.language} description={s.fixedHint}>
        <span>{s.languageValue}</span>
      </SettingRow>
      <SettingRow id="general--currency" label={s.currency} description={s.fixedHint}>
        <span>{s.currencyValue}</span>
      </SettingRow>
      <SettingRow id="general--timeZone" label={s.timeZone} description={s.timeZoneHint}>
        <span>{zone}</span>
      </SettingRow>
      <SettingRow id="general--formats" label={s.formats} description={s.fixedHint}>
        <span>{s.formatsValue}</span>
      </SettingRow>
    </SettingsGroup>
  );
}
