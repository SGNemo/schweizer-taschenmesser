import { create } from 'zustand';

/** What the idle question is about: a running session and the minutes nobody touched the device. */
interface IdleState {
  /** Epoch ms of the last input before the gap; `null` = no question open. */
  since: number | null;
  minutes: number;
  ask(since: number, minutes: number): void;
  clear(): void;
}

export const useIdle = create<IdleState>((set) => ({
  since: null,
  minutes: 0,
  ask: (since, minutes) => set({ since, minutes }),
  clear: () => set({ since: null, minutes: 0 }),
}));
