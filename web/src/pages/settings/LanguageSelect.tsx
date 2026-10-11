import { useState } from 'react';
import {
  LANG_NAMES,
  LANGS,
  isLangPref,
  setLangPref,
  systemLang,
  useLangPref,
  type LangPref,
} from '@/core/i18n/lang';
import { t } from '@/strings';
import { SelectField } from '@/ui';

/**
 * Language of the interface: "like the device" or one of the five languages, each named in its
 * own language. The switch is immediate (the texts of the new language load first).
 */
export function LanguageSelect({ labelHidden = true }: { labelHidden?: boolean }) {
  const pref = useLangPref();
  const [busy, setBusy] = useState(false);
  const s = t.settings.general;
  return (
    <SelectField
      label={s.language}
      labelHidden={labelHidden}
      value={pref}
      disabled={busy}
      onChange={(e) => {
        const next = e.target.value;
        if (!isLangPref(next)) return;
        setBusy(true);
        void setLangPref(next as LangPref).finally(() => setBusy(false));
      }}
    >
      <option value="system">{s.languageSystem(LANG_NAMES[systemLang()])}</option>
      {LANGS.map((l) => (
        <option key={l} value={l} lang={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </SelectField>
  );
}
