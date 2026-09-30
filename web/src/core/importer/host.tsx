import { create } from 'zustand';
import { getManifest } from '@/core/modules/registry';
import { OnboardingWizard } from './OnboardingWizard';

interface HostState {
  moduleId: string | null;
  open: (moduleId: string) => void;
  close: () => void;
}

export const useOnboardingHost = create<HostState>((set) => ({
  moduleId: null,
  open: (moduleId) => set({ moduleId }),
  close: () => set({ moduleId: null }),
}));

/**
 * The one wizard dialog of the app. It lives outside the pages on purpose: the "start data" buttons
 * sit in empty states that disappear as soon as the first entry is imported, which would tear the
 * dialog (and its result step) down with them.
 */
export function OnboardingHost() {
  const { moduleId, close } = useOnboardingHost();
  const manifest = moduleId ? getManifest(moduleId) : undefined;
  if (!manifest) return null;
  return <OnboardingWizard manifest={manifest} open onClose={close} />;
}
