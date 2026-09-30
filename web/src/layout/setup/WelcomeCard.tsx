import { useSetupHost } from '@/core/setup/host';
import { useSetupState } from '@/core/setup/hooks';
import { dismissSetup } from '@/core/setup/state';
import { t } from '@/strings';
import { Button, Card, patternStyles } from '@/ui';

/**
 * Discreet offer on the dashboard, only for a really empty app (`notStarted`; the start migration
 * marks every installation with data `dismissed`). "Später" ends the offer for good.
 */
export function WelcomeCard() {
  const state = useSetupState();
  const open = useSetupHost((s) => s.openWizard);
  if (state?.status !== 'notStarted') return null;
  return (
    <div data-testid="setup-welcome" style={{ marginBottom: 'var(--space-5)' }}>
      <Card>
        <h2>{t.setup.welcomeTitle}</h2>
        <p className={patternStyles.muted}>{t.setup.welcomeText}</p>
        <div className={patternStyles.hstackWrap}>
          <Button variant="primary" onClick={() => open()}>
            {t.setup.start}
          </Button>
          <Button onClick={() => void dismissSetup()}>{t.setup.welcomeLater}</Button>
        </div>
      </Card>
    </div>
  );
}
