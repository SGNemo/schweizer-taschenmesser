import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';

/** The current time as a state, refreshed every `intervalMs` while `active` (the injectable clock). */
export function useNow(intervalMs = 1000, active = true): number {
  const [value, setValue] = useState(() => now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setValue(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return value;
}
