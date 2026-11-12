/** About area: licence and model card of every model Nemo can download (never shipped with the app). */
import { LOCAL_MODELS, modelCardUrl } from '@/core/ai/local/catalogue';
import { t } from '@/strings';
import { SettingsGroup } from '@/ui';
import styles from './settings.module.css';

export function ModelLicensesSection() {
  return (
    <SettingsGroup
      id="model-licenses"
      title={t.ai.local.licensesTitle}
      description={t.ai.local.licensesIntro}
    >
      <ul>
        {LOCAL_MODELS.map((m) => (
          <li key={m.id} className={styles.licence}>
            <strong>{m.label}</strong>
            <a
              href={m.license.url}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.licenceLink}
            >
              {m.license.name}
            </a>
            <a
              href={modelCardUrl(m)}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.licenceLink}
            >
              huggingface.co/{m.repo}
            </a>
          </li>
        ))}
      </ul>
    </SettingsGroup>
  );
}
