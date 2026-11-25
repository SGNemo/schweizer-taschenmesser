import { useSyncExternalStore } from 'react';
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
  if (!enabled) return undefined;
  const all = readOfficial(lat, lon);
  return all ? activeOfficial(all, now(), tz) : undefined;
}
