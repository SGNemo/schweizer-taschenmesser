import { create } from 'zustand';

interface AppImportState {
  open: boolean;
  openDialog: () => void;
  close: () => void;
}

/** Tiny on purpose: the palette and the settings row only open the dialog; its code loads on demand. */
export const useAppImport = create<AppImportState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  close: () => set({ open: false }),
}));

export const openAppImport = () => useAppImport.getState().openDialog();
