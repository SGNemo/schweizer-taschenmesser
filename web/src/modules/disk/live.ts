import { create } from 'zustand';
import type { DiskIo, ProcInfo, SystemInfo } from '@/core/platform/system';
import { totalRates } from './logic/system';

/** 5 minutes at the 3-second refresh. */
export const LIVE_POINTS = 100;

const push = (list: readonly number[], v: number): number[] => [...list, v].slice(-LIVE_POINTS);

interface LiveState {
  info: SystemInfo | null;
  procs: ProcInfo[];
  io: DiskIo[];
  /** Mini history for the tiles. Only in memory of this session: nothing is stored or sent. */
  cpu: number[];
  ram: number[];
  down: number[];
  up: number[];
  update(info: SystemInfo, procs: ProcInfo[], io: DiskIo[]): void;
  clear(): void;
}

export const useSystemLive = create<LiveState>((set) => ({
  info: null,
  procs: [],
  io: [],
  cpu: [],
  ram: [],
  down: [],
  up: [],
  update(info, procs, io) {
    const rates = totalRates(info.network);
    set((s) => ({
      info,
      procs,
      io,
      cpu: push(s.cpu, info.cpu.usagePercent),
      ram: push(s.ram, (info.memory.usedBytes / Math.max(1, info.memory.totalBytes)) * 100),
      down: rates ? push(s.down, rates.down) : s.down,
      up: rates ? push(s.up, rates.up) : s.up,
    }));
  },
  clear: () => set({ info: null, procs: [], io: [], cpu: [], ram: [], down: [], up: [] }),
}));
