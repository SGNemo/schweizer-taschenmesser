import { useState } from 'react';
import { hasStartData } from '@/core/dataapi/onboarding';
import { getManifest } from '@/core/modules/registry';
import { setupStepIdForModule } from '@/core/setup/registry';
import { useSetupHost } from '@/core/setup/host';
import { t } from '@/strings';
import { RowMenu, type RowMenuItem } from '@/ui';
import { useOnboardingHost } from './host';

/**
 * The page's import entries for its "⋯" menu (FOCUS checklist 3, C23): "Importieren" and, when the setup assistant
 * has a step for the module, "Einrichtung öffnen". Empty when the module has no importer. An empty page then shows
 * one verb (the toolbar's primary action) instead of three.
 */
export function useStartDataItems(moduleId: string): RowMenuItem[] {
  const open = useOnboardingHost((s) => s.open);
  const openSetup = useSetupHost((s) => s.openWizard);
  const manifest = getManifest(moduleId);
  if (!manifest || !hasStartData(manifest)) return [];
  const stepId = setupStepIdForModule(moduleId, true);
  return [
    { id: 'import', label: t.onboarding.button, onSelect: () => open(moduleId) },
    ...(stepId ? [{ id: 'setup', label: t.setup.open, onSelect: () => openSetup(stepId) }] : []),
  ];
}

/**
 * A page's "⋯" menu with the import entries after the page's own entries (`items`). Renders nothing when both are
 * empty. New entries go into `items`; the menu grows downwards, the toolbar keeps its layout.
 */
export function StartDataMenu({
  moduleId,
  items = [],
  label = t.onboarding.pageMenu,
}: {
  moduleId: string;
  items?: RowMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const start = useStartDataItems(moduleId);
  const all = [...items, ...start];
  if (all.length === 0) return null;
  return <RowMenu label={label} items={all} open={open} onOpenChange={setOpen} />;
}
