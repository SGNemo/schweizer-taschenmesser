import { create } from 'zustand';

interface HostState {
  open: boolean;
  /** Jump straight to this step (from the checklist). */
  stepId: string | null;
  openWizard: (stepId?: string) => void;
  close: () => void;
}

/** Open state of the setup assistant; the dialog itself lives in `layout/setup/SetupHost`. */
export const useSetupHost = create<HostState>((set) => ({
  open: false,
  stepId: null,
  openWizard: (stepId) => set({ open: true, stepId: stepId ?? null }),
  close: () => set({ open: false, stepId: null }),
}));
