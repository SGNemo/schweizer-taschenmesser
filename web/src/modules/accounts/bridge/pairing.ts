import { create } from 'zustand';
import type { PendingPairing } from './handler';

/** The open pairing request the user has to confirm (memory only; the code is not a secret key). */
export const usePairingRequest = create<{ pending: PendingPairing | null }>(() => ({
  pending: null,
}));
