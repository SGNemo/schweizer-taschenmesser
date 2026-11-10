import { getPlatform } from '@/core/platform';

/**
 * "Keep the screen on" has one switch in the platform and more than one user (the cockpit, the
 * remote control). Each takes a hold and gives it back; the screen may sleep again only when the
 * last hold is gone – so leaving one of them never switches it off for the other.
 */
let holds = 0;

const apply = (on: boolean) =>
  void getPlatform()
    .display.setKeepAwake(on)
    .catch(() => undefined);

/** Keeps the screen on until the returned function is called (calling it twice is harmless). */
export function holdKeepAwake(): () => void {
  holds += 1;
  if (holds === 1) apply(true);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holds -= 1;
    if (holds === 0) apply(false);
  };
}
