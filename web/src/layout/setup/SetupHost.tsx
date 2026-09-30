import { useSetupHost } from '@/core/setup/host';
import { SetupWizard } from './SetupWizard';

/** The one setup dialog of the app, mounted in the shell (like the start-data wizard). */
export function SetupHost() {
  const { open, stepId, close } = useSetupHost();
  return open ? <SetupWizard stepId={stepId} onClose={close} /> : null;
}
