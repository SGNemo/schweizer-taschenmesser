import { create } from 'zustand';
import type { ExchangePcStatus } from '@/core/platform/types';
import type { PhoneProblem } from './logic';

/** What the page and the widget show about the connection (memory only). */
export interface ExchangeView {
  /** PC: the hub's state, `null` until read. */
  pc: ExchangePcStatus | null;
  /** Phone: a session with the PC is open. */
  open: boolean;
  /** Phone: why there is none (or `null`). */
  problem: PhoneProblem | null;
  minutes: number | null;
}

export const useExchangeView = create<ExchangeView>(() => ({
  pc: null,
  open: false,
  problem: null,
  minutes: null,
}));
