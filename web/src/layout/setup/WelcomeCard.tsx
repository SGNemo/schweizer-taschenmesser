import { useSetupHost } from '@/core/setup/host';
import { useSetupState } from '@/core/setup/hooks';
import { dismissSetup } from '@/core/setup/state';
import { t } from '@/strings';
import { Suspense } from 'react';
import { Button, Card } from '@/ui';
import { TestDataOffer } from '../devTools';
import styles from './WelcomeCard.module.css';

/**
 * Discreet offer on the dashboard, only for a really empty app (`notStarted`; the start migration
 * marks every installation with data `dismissed`). "Später" ends the offer for good. One question
 * only (round 5, demo-a/demo-c): the reading aid is offered in the assistant's step "Fokus-Hilfen".
 */
export function WelcomeCard() {
  const state = useSetupState();
  const open = useSetupHost((s) => s.openWizard);
  if (state?.status !== 'notStarted') return null;
  return (
    <div data-testid="setup-welcome" className={styles.card}>
      <Card>
        <h2>{t.setup.welcomeTitle}</h2>
        <p className={styles.text}>{t.setup.welcomeText}</p>
        <div className={styles.buttons}>
          <Button variant="primary" onClick={() => open()}>
            {t.setup.start}
          </Button>
          <Button onClick={() => void dismissSetup()}>{t.setup.welcomeLater}</Button>
        </div>
        {TestDataOffer ? (
          <Suspense fallback={null}>
            <TestDataOffer />
          </Suspense>
        ) : null}
      </Card>
    </div>
  );
}
