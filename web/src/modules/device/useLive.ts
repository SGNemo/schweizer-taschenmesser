import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { ProcInfo, SystemInfo } from '@/core/platform/system';
import { LIVE_MS, percentOf, pushPoint, totalRates } from './system';

export interface LiveState {
  info: SystemInfo | null;
  procs: ProcInfo[];
  /** Short history for the tiles (memory of this visit only: nothing is stored or sent). */
  cpu: number[];
  ram: number[];
  down: number[];
  failed: boolean;
}

const EMPTY: LiveState = { info: null, procs: [], cpu: [], ram: [], down: [], failed: false };

/**
 * Live facts of this computer while the page is open: one reading every three seconds, none while the window is
 * hidden or the reading is paused (the next one comes at once when it shows again). The history is state of the
 * page: leaving it drops the history. `enabled` = this platform can read them (desktop).
 */
export function useLiveSystem(enabled: boolean, paused: boolean): LiveState {
  const [state, setState] = useState<LiveState>(EMPTY);
  useEffect(() => {
    if (!enabled || paused) return;
    const system = getPlatform().system;
    let alive = true;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [info, procs] = await Promise.all([
          system.info(),
          system.processes().catch(() => [] as ProcInfo[]),
        ]);
        if (!alive) return;
        const rates = totalRates(info.network);
        setState((s) => ({
          info,
          procs,
          cpu: pushPoint(s.cpu, info.cpu.usagePercent),
          ram: pushPoint(s.ram, percentOf(info.memory.usedBytes, info.memory.totalBytes)),
          down: rates ? pushPoint(s.down, rates.down) : s.down,
          failed: false,
        }));
      } catch {
        if (alive) setState((s) => ({ ...s, failed: true }));
      } finally {
        busy = false;
      }
    };
    // A gap (paused, hidden window) would join two periods in the curves as if no time had passed: they start anew.
    const restart = () => setState((s) => ({ ...s, cpu: [], ram: [], down: [] }));
    const onShow = () => {
      if (document.hidden) return;
      restart();
      void load();
    };
    restart();
    void load();
    const id = setInterval(() => void load(), LIVE_MS);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [enabled, paused]);
  return state;
}

const PAUSE_KEY = 'tm-device-live-paused';

/** "Anhalten" is kept on this device (a calm page stays calm after a reload); storage may be blocked. */
export function usePaused(): [boolean, (v: boolean) => void] {
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem(PAUSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setPaused(v);
    try {
      if (v) localStorage.setItem(PAUSE_KEY, '1');
      else localStorage.removeItem(PAUSE_KEY);
    } catch {
      // Not kept; the page still pauses for this visit.
    }
  };
  return [paused, set];
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

/**
 * The phone's battery from the WebView (Battery Status API): level and charging only. Android only – a desktop
 * browser reports "100 %, charging" for a PC without a battery, which would be wrong.
 */
export function usePhoneBattery(enabled: boolean): { percent: number; charging: boolean } | null {
  const [value, setValue] = useState<{ percent: number; charging: boolean } | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!enabled || typeof nav.getBattery !== 'function') return;
    let alive = true;
    let battery: BatteryManagerLike | null = null;
    const read = () => {
      if (alive && battery)
        setValue({ percent: Math.round(battery.level * 100), charging: battery.charging });
    };
    nav.getBattery().then(
      (b) => {
        // The page may be gone before the WebView answers: then no listener is attached at all.
        if (!alive) return;
        battery = b;
        read();
        b.addEventListener('levelchange', read);
        b.addEventListener('chargingchange', read);
      },
      () => undefined,
    );
    return () => {
      alive = false;
      battery?.removeEventListener('levelchange', read);
      battery?.removeEventListener('chargingchange', read);
    };
  }, [enabled]);
  return value;
}
