import { hasStartData } from '@/core/dataapi/onboarding';
import { getManifest } from '@/core/modules/registry';
import { t } from '@/strings';
import { Button } from '@/ui';
import { useOnboardingHost } from './host';

/** Opens the start-data wizard of a module; renders nothing when the module has no importer. */
export function StartDataButton({
  moduleId,
  variant = 'secondary',
}: {
  moduleId: string;
  variant?: 'primary' | 'secondary';
}) {
  const open = useOnboardingHost((s) => s.open);
  const manifest = getManifest(moduleId);
  if (!manifest || !hasStartData(manifest)) return null;
  return (
    <Button variant={variant} onClick={() => open(moduleId)}>
      {t.onboarding.button}
    </Button>
  );
}
