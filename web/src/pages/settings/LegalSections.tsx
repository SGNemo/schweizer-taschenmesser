/** Settings → Über Nemo → Rechtliches: imprint and contact, privacy notices, licences. Not legal advice. */
import { useState } from 'react';
import type licensesJson from '@/core/about/licenses.json';
import { dataFlows } from '@/core/legal/dataFlows';
import { LEGAL_IDENTITY } from '@/core/legal/identity';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { tLegal } from '@/strings.legal';
import { Button, SettingRow, SettingsGroup } from '@/ui';
import styles from './settings.module.css';

const REPO = 'https://github.com/SGNemo/schweizer-taschenmesser';
const LICENSE_URL = `${REPO}/blob/main/LICENSE`;

/** Contact and a link to the full imprint on the website (the postal address is not kept in the app or the repository). */
export function LegalImprintSection() {
  const l = tLegal.use();
  const id = LEGAL_IDENTITY;
  return (
    <SettingsGroup id="legal-imprint" title={l.imprint.title} description={l.imprint.intro}>
      <SettingRow id="legal-imprint--email" label={l.imprint.email}>
        <strong className={styles.value}>{id.email}</strong>
      </SettingRow>
      <p className={styles.muted}>{l.imprint.note}</p>
      <SettingRow id="legal-imprint--site" label={l.imprint.website}>
        <Button onClick={() => void getPlatform().app.openUrl(id.imprintUrl)}>
          {t.about.links.open}
        </Button>
      </SettingRow>
    </SettingsGroup>
  );
}

/** What is stored locally and what leaves the device, when and to whom (one entry per data flow). */
export function LegalPrivacySection() {
  const l = tLegal.use();
  return (
    <SettingsGroup id="legal-privacy" title={l.privacy.title} description={l.privacy.intro}>
      {dataFlows(l).map((f) => (
        <details key={f.id} className={styles.details} data-testid={`flow-${f.id}`}>
          <summary>{f.title}</summary>
          <dl className={styles.status}>
            <dt>{l.privacy.what}</dt>
            <dd>{f.what}</dd>
            <dt>{l.privacy.to}</dt>
            <dd>{f.to}</dd>
            <dt>{l.privacy.when}</dt>
            <dd>{f.when}</dd>
          </dl>
        </details>
      ))}
      <p className={styles.muted}>{l.privacy.rights}</p>
    </SettingsGroup>
  );
}

type Licenses = typeof licensesJson;
const GROUPS = ['npm', 'cargo', 'gradle', 'assets', 'models'] as const;

/** App licence plus the generated list; the (large) list is loaded when the section is opened. */
export function LegalLicensesSection() {
  const l = tLegal.use();
  const [data, setData] = useState<Licenses | 'loading' | 'failed' | undefined>();
  const load = () => {
    if (data) return;
    setData('loading');
    void import('@/core/about/licenses.json').then(
      (m) => setData(m.default),
      () => setData('failed'),
    );
  };
  return (
    <SettingsGroup id="legal-licenses" title={l.licenses.title} description={l.licenses.app}>
      <SettingRow id="legal-licenses--app" label={t.about.license}>
        <Button onClick={() => void getPlatform().app.openUrl(LICENSE_URL)}>
          {l.licenses.appLicense}
        </Button>
      </SettingRow>
      <ul className={styles.aboutList}>
        {t.about.licenseList.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {GROUPS.map((g) => (
        <details key={g} className={styles.details} onToggle={load} data-testid={`licenses-${g}`}>
          <summary>
            {l.licenses.groups[g]}
            {typeof data === 'object' ? ` · ${l.licenses.count(data[g].length)}` : ''}
          </summary>
          {data === 'loading' || data === undefined ? <p>{l.licenses.loading}</p> : null}
          {data === 'failed' ? <p className={styles.error}>{l.licenses.failed}</p> : null}
          {typeof data === 'object' ? (
            <ul className={styles.aboutList}>
              {data[g].map((e) => (
                <li key={`${e.name}@${e.version}`}>
                  {e.name} {e.version} – {e.license}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ))}
      <p className={styles.muted}>{l.licenses.note}</p>
    </SettingsGroup>
  );
}
