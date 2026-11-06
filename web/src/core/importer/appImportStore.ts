import { create } from 'zustand';

interface AppImportState {
  open: boolean;
  /** Set when the sheet opens on the summary of a finished run (after its last part). */
  runId?: string;
  openDialog: () => void;
  /** Shows what a multi-part run wrote, with "undo the whole run". */
  showRun: (groupId: string) => void;
  close: () => void;
}

/** Tiny on purpose: the palette and the settings row only open the dialog; its code loads on demand. */
export const useAppImport = create<AppImportState>((set) => ({
  open: false,
  openDialog: () => set({ open: true, runId: undefined }),
  showRun: (groupId) => set({ open: true, runId: groupId }),
  close: () => set({ open: false, runId: undefined }),
}));

export const openAppImport = () => useAppImport.getState().openDialog();
