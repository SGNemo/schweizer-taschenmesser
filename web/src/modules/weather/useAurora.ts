import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  auroraTonight,
  onKpChange,
  readKp,
  refreshKp,
  type AuroraTonight,
} from '@/core/sky/aurora';
import { now } from '@/core/time/now';

/**
 * Aurora possible tonight at the main place (CONCEPT-SOURCES §2): asks the general SWPC file at most every 3 h while
 * the page is open, only when the place can see an aurora at all; no position leaves the device. `enabled` is false
 * for an extra place, without a place and while "Mond und Himmelsereignisse" is off.
 */
export function useAurora(lat: number, lon: number, enabled: boolean): AuroraTonight | undefined {
  useEffect(() => {
    if (enabled) void refreshKp(lat, lon, true);
  }, [enabled, lat, lon]);
  const version = useSyncExternalStore(onKpChange, kpVersion, kpVersion);
  const minute = Math.floor(now() / 60_000);
  return useMemo(() => {
    // `version` changes when a new file is stored: read it again then.
    if (!enabled || version < 0) return undefined;
    const steps = readKp();
    return steps ? auroraTonight(steps, lat, lon, minute * 60_000) : undefined;
  }, [enabled, lat, lon, minute, version]);
}

let v = 0;
onKpChange(() => {
  v++;
});
const kpVersion = () => v;
