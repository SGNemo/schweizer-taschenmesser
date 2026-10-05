/** About area: licence and model card of every model Nemo can download (never shipped with the app). */
import { LOCAL_MODELS, modelCardUrl } from '@/core/ai/local/catalogue';
import { t } from '@/strings';
import { SettingRow, SettingsGroup } from '@/ui';

export function ModelLicensesSection() {
  return (
    <SettingsGroup
      id="model-licenses"
      title={t.ai.local.licensesTitle}
      description={t.ai.local.licensesIntro}
    >
      {LOCAL_MODELS.map((m) => (
        <SettingRow
          key={m.id}
          label={m.name}
          description={
            <>
              <a href={m.license.url} target="_blank" rel="noreferrer noopener">
                {m.license.name}
              </a>
              {' · '}
              <a href={modelCardUrl(m)} target="_blank" rel="noreferrer noopener">
                huggingface.co/{m.repo}
              </a>
            </>
          }
        />
      ))}
    </SettingsGroup>
  );
}
