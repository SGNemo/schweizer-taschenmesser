import { useEffect, useState } from 'react';
import {
  CORE_SCOPE,
  coreSettingsSchema,
  DEFAULT_CORE,
  type CoreSettings,
} from '@/core/settings/core';
import { setSettings, useSettings } from '@/core/settings/settings';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { useUiStore, type TextSizeChoice, type ThemeChoice } from '@/stores/ui';
import { SelectField, TextField } from '@/ui';
import { LanguageSelect } from '@/pages/settings/LanguageSelect';

const s = t.setup.steps.basics;
const SIZE_ORDER: readonly TextSizeChoice[] = ['small', 'normal', 'large', 'xlarge'];

/**
 * Language, name, theme and week start. The language switches at once (the rest of the assistant
 * then speaks it); the other drafts stay local until "Weiter"; the current values are shown.
 */
export default function BasicsStep({ registerCommit, mode }: SetupStepProps) {
  const [saved] = useSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE);
  const theme = useUiStore((st) => st.theme);
  const setTheme = useUiStore((st) => st.setTheme);
  const textSize = useUiStore((st) => st.textSize);
  const setTextSize = useUiStore((st) => st.setTextSize);
  const [draft, setDraft] = useState<CoreSettings | undefined>();
  const [themeDraft, setThemeDraft] = useState<ThemeChoice | undefined>();
  const values = draft ?? saved;
  const chosenTheme = themeDraft ?? theme;

  useEffect(() => {
    registerCommit(async () => {
      if (draft) await setSettings(CORE_SCOPE, draft);
      if (themeDraft) setTheme(themeDraft);
    });
    return () => registerCommit(null);
  }, [registerCommit, draft, themeDraft, setTheme]);

  if (!values) return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const quick = mode === 'quick';
  const more = (
    <>
      <SelectField
        label={t.settings.theme}
        value={chosenTheme}
        onChange={(e) => setThemeDraft(e.target.value as ThemeChoice)}
      >
        <option value="system">{t.settings.themeSystem}</option>
        <option value="light">{t.settings.themeLight}</option>
        <option value="dark">{t.settings.themeDark}</option>
      </SelectField>
      <SelectField
        label={s.weekStart}
        value={values.weekStart}
        onChange={(e) =>
          setDraft({ ...values, weekStart: e.target.value as CoreSettings['weekStart'] })
        }
      >
        <option value="mon">{s.monday}</option>
        <option value="sun">{s.sunday}</option>
      </SelectField>
      <div>
        <strong>{s.fixedTitle}</strong>
        <ul>
          <li>{s.timezone(zone)}</li>
          <li>{s.currency}</li>
        </ul>
      </div>
    </>
  );
  return (
    <>
      <LanguageSelect labelHidden={false} />
      <TextField
        label={s.name}
        hint={s.nameHint}
        value={values.displayName}
        maxLength={60}
        autoComplete="off"
        data-autofocus
        onChange={(e) => setDraft({ ...values, displayName: e.target.value })}
      />
      {/* Applied at once: someone who needs larger text must see the effect of the choice. */}
      <SelectField
        label={s.textSize}
        value={textSize}
        onChange={(e) => setTextSize(e.target.value as TextSizeChoice)}
      >
        {SIZE_ORDER.map((size) => (
          <option key={size} value={size}>
            {t.settings.textSizeOptions[size]}
          </option>
        ))}
      </SelectField>
      {quick ? (
        <details>
          <summary>{s.more}</summary>
          {more}
        </details>
      ) : (
        more
      )}
    </>
  );
}
