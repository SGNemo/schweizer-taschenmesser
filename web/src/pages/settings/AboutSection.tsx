import { useEffect, useState } from 'react';
import { Card, Logo } from '@/ui';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import styles from './settings.module.css';

export function AboutSection() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    void getPlatform().app.version().then(setVersion);
  }, []);
  return (
    <Card>
      <div className={styles.about}>
        <Logo size={64} title={t.appName} />
        <div>
          <p className={styles.aboutName}>{t.appName}</p>
          <p>{t.about.tagline}</p>
          <p data-testid="about-version">
            {t.about.version}: <strong>{version || '…'}</strong>
          </p>
        </div>
      </div>
      <h3 className={styles.aboutSub}>{t.about.licenses}</h3>
      <ul className={styles.aboutList}>
        {t.about.licenseList.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Card>
  );
}
