import { useEffect, useRef, useState } from 'react';
import { startMinuteTicker } from './minuteTicker';
import { now } from './now';

/**
 * The current time in ms, re-read at every full minute (and when the page comes back). One timer per mounted
 * user (the clock next to the logo, the Uhr module's page and widget); nothing ticks between minutes.
 */
export function useMinuteNow(): number {
  const [at, setAt] = useState(now);
  // The time rendered first: a minute that turned before the effect runs is shown at once.
  const shown = useRef(at);
  useEffect(() => startMinuteTicker(setAt, shown.current), []);
  return at;
}
