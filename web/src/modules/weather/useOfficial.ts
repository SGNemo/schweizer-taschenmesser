import { useEffect, useState, useSyncExternalStore } from 'react';
import { now } from '@/core/time/now';
import {
  activeOfficial,
  onOfficialChange,
  readOfficial,
  type OfficialWarning,
} from '@/core/weather/warningsOfficial';

let v = 0;
onOfficialChange(() => {
  v++;
});
const version = () => v;

/**
 * The official DWD warnings in force now or later today at the main place (asked with the forecast in `useWeather`);
 * `undefined` when there is no usable answer: switch off, outside Germany, an extra place, or older than 60 minutes.
 */
export function useOfficial(
  lat: number,
  lon: number,
  tz: string | undefined,
  enabled: boolean,
): OfficialWarning[] | undefined {
  useSyncExternalStore(onOfficialChange, version, version);
  const all = enabled ? readOfficial(lat, lon) : undefined;
  const shown = all ? activeOfficial(all, now(), tz) : undefined;
  // While a warning is shown, look again every minute: it goes at its end and when the answer passes 60 minutes.
  const [, tick] = useState(0);
  const showing = !!shown?.length;
  useEffect(() => {
    if (!showing) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [showing]);
  return shown;
}
