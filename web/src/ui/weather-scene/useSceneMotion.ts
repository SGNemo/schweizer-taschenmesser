import { useEffect, useState, type RefObject } from 'react';
import { motionReduced } from '@/core/shell/topbarCollapse';

/** How long the motion lasts after the page opens (CONCEPT §9, A11Y §3). */
export const MOTION_MS = 5000;
/** A page hidden longer than this plays the motion again when it comes back. */
export const REPLAY_AFTER_MS = 60_000;

export type MotionState = 'run' | 'rest' | undefined;

/**
 * The scene's motion: `run` for five seconds after the page opens, then `rest` (the animations have ended on the
 * still picture and stay there). Paused while the page is hidden or the stage is out of view; never with less motion
 * asked for (system or app) or when `allowed` is false ("Standbild", "Schlicht", "Ruhig", "Modulfarben: Aus").
 */
export function useSceneMotion(
  ref: RefObject<Element | null>,
  allowed: boolean,
): { motion: MotionState; paused: boolean; round: number } {
  const [hidden, setHidden] = useState(false);
  const [away, setAway] = useState(false);
  // Each opening (and each return after a long absence) is a round; `rested` is the last round that came to rest.
  const [round, setRound] = useState(0);
  const [rested, setRested] = useState(-1);
  const on = allowed && !motionReduced();
  useEffect(() => {
    if (!on) return;
    const rest = () => setRested(round);
    let left = MOTION_MS;
    let started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(rest, left);
    // UI timing, not logic: the device clock is right here (`core/time/now` is for dates the app reasons about).
    let hiddenAt = 0;
    let out = false;
    const pause = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = undefined;
      left -= Date.now() - started;
    };
    const resume = () => {
      if (left > 0 && !timer && !document.hidden && !out) {
        started = Date.now();
        timer = setTimeout(rest, left);
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        setHidden(true);
        pause();
        return;
      }
      setHidden(false);
      if (hiddenAt && Date.now() - hiddenAt > REPLAY_AFTER_MS) {
        setRound((r) => r + 1);
        return;
      }
      resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const el = ref.current;
    const io =
      el && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            out = !entries.some((e) => e.isIntersecting);
            setAway(out);
            if (out) pause();
            else resume();
          })
        : undefined;
    if (el) io?.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
    };
  }, [on, ref, round]);
  const motion: MotionState = !on ? undefined : rested === round ? 'rest' : 'run';
  return { motion, paused: hidden || away, round };
}
