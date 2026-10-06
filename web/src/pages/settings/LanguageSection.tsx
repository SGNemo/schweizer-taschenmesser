import { LANGS, setLang, useLang, type Lang } from '@/core/i18n/lang';
import { tLang } from '@/strings.i18n';
import { Segmented, SettingRow, SettingsGroup } from '@/ui';

export function LanguageSection() {
  const lang = useLang();
  const s = tLang.use();
  return (
    <SettingsGroup id="language" title={s.title}>
      <SettingRow id="language--ui" label={s.label} description={s.hint}>
        <Segmented<Lang>
          label={s.label}
          value={lang}
          options={LANGS.map((v) => ({ value: v, label: s.options[v] }))}
          onChange={setLang}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
