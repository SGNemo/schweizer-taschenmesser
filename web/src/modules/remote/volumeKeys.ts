import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { createHoldGate } from '@/core/remote/session';
import { now } from '@/core/time/now';
import { remoteSession } from './session';

/** How often the keys are asked for again while they are wanted (the shell's lease is longer). */
export const RENEW_MS = 2000;

/**
 * The phone's hardware volume keys change the PC's volume while a session is open (and for a few
 * seconds after it was last alive – `takesVolumeKeys`), on every view of the module. In every
 * other state they stay the phone's own. A key press is an action like the buttons "Lauter" and
 * "Leiser": always at the media level, held keys at most a few steps a second, and a repeat never
 * opens a connection.
 *
 * The shell hands the keys over only for a short lease that this renews; when the page goes, or
 * stops asking for any reason, they return to the phone by themselves. Returns whether the keys
 * are with the PC right now (the page says so in one quiet line).
 */
export function useVolumeKeys(enabled: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const keys = getPlatform().display.volumeKeys;
    if (!keys || !enabled) return;
    let over = false;
    let asked = false;
    const gate = createHoldGate(now);
    /** `renew`: the regular look – asks again while the keys are wanted (the lease). */
    const sync = (renew = false) => {
      const wanted = !over && remoteSession.takesVolumeKeys();
      setHeld(wanted);
      // the shell hears of a change, and of the renewal – not of every state the PC reports
      if (wanted === asked && !(renew && wanted)) return;
      asked = wanted;
      void keys.hold(wanted).catch(() => undefined);
    };
    const stopKeys = keys.onKey((key, repeat) => {
      if (over || !remoteSession.takesVolumeKeys()) return;
      // the first press always goes; a held key at most a few times a second
      if (repeat && !gate()) return;
      if (!repeat) gate();
      void remoteSession.send(key === 'up' ? 'volume-up' : 'volume-down', { repeat });
    });
    // at once on every change of the session, and regularly: the lease is renewed, and the few
    // seconds after a session was last alive run out without an event
    const stopView = remoteSession.subscribe(() => sync());
    const timer = setInterval(() => sync(true), RENEW_MS);
    sync();
    return () => {
      over = true;
      clearInterval(timer);
      stopView();
      stopKeys();
      setHeld(false);
      if (asked) void keys.hold(false).catch(() => undefined);
    };
  }, [enabled]);
  return held;
}
