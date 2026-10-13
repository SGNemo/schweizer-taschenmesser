import {
  FORMAT_REGIONS,
  defaultRegion,
  regionLabel,
  setFormatPref,
  useFormatPref,
  type FormatPref,
} from '@/core/i18n/format';
import { useLang } from '@/core/i18n/lang';
import { CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE } from '@/core/settings/core';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Segmented, SelectField, SettingRow, SettingsGroup, TextField } from '@/ui';
import { LanguageSelect } from './LanguageSelect';

/** Sample date and amount in a format locale, e.g. "31.12.2026, 1.234,56 €". */
function sample(locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(
    Date.UTC(2026, 11, 31),
  );
  const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
    1234.56,
  );
  return t.settings.general.formatsExample(date, amount);
}

/**
 * Name and week start (synced scope `core`); language and number/date formats are per device;
 * currency and time zone are shown as facts.
 */
export function GeneralSection() {
  const [values, patch] = useSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE);
  const lang = useLang();
  const formatPref = useFormatPref();
  if (!values) return null;
  const s = t.settings.general;
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
      <SettingRow id="general--language" label={s.language} description={s.languageHint}>
        <LanguageSelect />
      </SettingRow>
      <SettingRow id="general--weekStart" label={s.weekStart} description={s.weekStartHint}>
        <Segmented
          label={s.weekStart}
          value={values.weekStart}
          options={[
            { value: 'mon', label: s.weekStartOptions.mon },
            { value: 'sun', label: s.weekStartOptions.sun },
          ]}
          onChange={(weekStart) => void patch({ weekStart })}
        />
      </SettingRow>
      <SettingRow id="general--formats" label={s.formats} description={s.formatsHint}>
        <SelectField
          label={s.formats}
          labelHidden
          value={formatPref}
          onChange={(e) => setFormatPref(e.target.value as FormatPref)}
        >
          <option value="auto">{s.formatsAuto(sample(defaultRegion(lang)))}</option>
          {FORMAT_REGIONS.map((r) => (
            <option key={r} value={r}>
              {s.formatsRegion(regionLabel(r, lang), sample(r))}
            </option>
          ))}
        </SelectField>
      </SettingRow>
      <SettingRow id="general--currency" label={s.currency} description={s.fixedHint}>
        <span>{s.currencyValue}</span>
      </SettingRow>
      <SettingRow id="general--timeZone" label={s.timeZone} description={s.timeZoneHint}>
        <span>{zone}</span>
      </SettingRow>
    </SettingsGroup>
  );
}
