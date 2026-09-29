import { useState } from 'react';
import { getManifest } from '@/core/modules/registry';
import { t } from '@/strings';
import { Button } from '@/ui';
import { hasImporters, OnboardingWizard } from './OnboardingWizard';

/** Opens the start-data wizard of a module; renders nothing when the module has no importer. */
export function StartDataButton({
  moduleId,
  variant = 'secondary',
}: {
  moduleId: string;
  variant?: 'primary' | 'secondary';
}) {
  const manifest = getManifest(moduleId);
  const [open, setOpen] = useState(false);
  if (!manifest || !hasImporters(manifest)) return null;
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {t.onboarding.button}
      </Button>
      <OnboardingWizard manifest={manifest} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
