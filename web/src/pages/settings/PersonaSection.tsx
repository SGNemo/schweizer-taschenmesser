import { z } from 'zod';
import { useSettings } from '@/core/settings/settings';
import {
  DEFAULT_MAIL_PROVIDER,
  MAIL_PROVIDER_IDS,
  PERSONA_SCOPE,
  type MailProviderId,
} from '@/core/tools/mailProviders';
import { t } from '@/strings';
import { SelectField, SettingRow, SettingsGroup } from '@/ui';

const schema = z.object({
  mailProvider: z.enum(['guerrilla', 'tempmail', 'tenminute']).catch(DEFAULT_MAIL_PROVIDER),
});

/**
 * Default disposable-mail provider of the anonymous persona tool. The tool shows the same setting (synced
 * scope `tools.persona`); a click opens the site in the browser, nothing is fetched from it.
 */
export function PersonaSection() {
  const [stored, patch] = useSettings(PERSONA_SCOPE, schema, {
    mailProvider: DEFAULT_MAIL_PROVIDER,
  });
  if (!stored) return null;
  const s = t.tools.persona;
  return (
    <SettingsGroup id="tools-persona" title={s.name} description={s.description}>
      <SettingRow label={s.mailProvider} description={s.mailHint}>
        <SelectField
          label={s.mailProvider}
          labelHidden
          value={stored.mailProvider}
          onChange={(e) => void patch({ mailProvider: e.target.value as MailProviderId })}
        >
          {MAIL_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {s.providers[id]}
            </option>
          ))}
        </SelectField>
      </SettingRow>
    </SettingsGroup>
  );
}
