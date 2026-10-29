import { hasStartData } from '@/core/dataapi/onboarding';
import { getManifest } from '@/core/modules/registry';
import { setupStepIdForModule } from '@/core/setup/registry';
import { useSetupHost } from '@/core/setup/host';
import { t } from '@/strings';
import { Button } from '@/ui';
import { useOnboardingHost } from './host';

/**
 * Opens the start-data wizard of a module; renders nothing when the module has no importer. Next to
 * the button sits a quiet text link into the setup assistant at the matching step, only when the
 * assistant has one. The assistant never opens by itself, only on this click.
 */
export function StartDataButton({
  moduleId,
  variant = 'secondary',
  setupLink = true,
}: {
  moduleId: string;
  variant?: 'primary' | 'secondary';
  /** `false` where the button already sits inside the assistant or a settings list. */
  setupLink?: boolean;
}) {
  const open = useOnboardingHost((s) => s.open);
  const openSetup = useSetupHost((s) => s.openWizard);
  const manifest = getManifest(moduleId);
  if (!manifest || !hasStartData(manifest)) return null;
  const stepId = setupLink ? setupStepIdForModule(moduleId, true) : undefined;
  return (
    <>
      <Button variant={variant} onClick={() => open(moduleId)}>
        {t.onboarding.button}
      </Button>
      {stepId ? (
        <Button variant="ghost" onClick={() => openSetup(stepId)}>
          {t.setup.open}
        </Button>
      ) : null}
    </>
  );
}
