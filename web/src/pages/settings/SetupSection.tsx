import { useSetupHost } from '@/core/setup/host';
import { useSetupState } from '@/core/setup/hooks';
import { setChecklistHidden } from '@/core/setup/state';
import { t } from '@/strings';
import { Button, Card, Switch } from '@/ui';

/** Starts or resumes the setup assistant – also months later, on an app full of data. */
export function SetupSection() {
  const state = useSetupState();
  const open = useSetupHost((s) => s.openWizard);
  const progress = !!state && (state.doneSteps.length > 0 || state.status === 'inProgress');
  return (
    <Card>
      <p style={{ color: 'var(--text-muted)' }}>{t.setup.intro}</p>
      <Button variant="primary" onClick={() => open()}>
        {progress ? t.setup.resume : t.setup.start}
      </Button>
      {state ? (
        <Switch
          label={t.setup.showChecklist}
          checked={!state.checklistHidden}
          onChange={(on) => void setChecklistHidden(!on)}
        />
      ) : null}
    </Card>
  );
}
