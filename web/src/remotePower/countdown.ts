import type { PowerCountdown } from '@/core/platform/tauri/remotePower';

/** How often the window reads the countdown. The number changes once a second. */
export const READ_EVERY_MS = 250;
/** A key press this soon after the window appeared was meant for another program: ignored. */
export const KEY_GRACE_MS = 400;

export interface CountdownApi {
  status(): Promise<PowerCountdown | null>;
  cancel(): Promise<void>;
}

/**
 * The PC's countdown before a phone switches it off (rules: `docs/rules/remote-control.md`): one
 * still sentence that names the device and the action, one quiet line, one button. No bar, no
 * animation, no sound, no red. The shell closes the window when nothing runs any more. Returns the
 * stop function.
 */
export function mountCountdown(
  root: HTMLElement,
  api: CountdownApi,
  clock: () => number = () => performance.now(),
): () => void {
  const doc = root.ownerDocument;
  // the visible sentence changes every second and is not live; screen readers hear it once, when
  // the countdown appears (the hidden line), and with the button it describes
  const sentence = doc.createElement('p');
  sentence.className = 'sentence';
  sentence.id = 'power-sentence';
  const live = doc.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  const note = doc.createElement('p');
  note.className = 'note';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'cancel';
  button.dataset.testid = 'power-cancel';
  button.setAttribute('aria-describedby', 'power-sentence');
  let shownAt = 0;
  const stop = () => {
    button.disabled = true;
    void api.cancel().finally(() => {
      button.disabled = false;
    });
  };
  button.addEventListener('click', (e) => {
    // a key press (no pointer) right as the window appeared was typed into something else
    if (e.detail === 0 && clock() - shownAt < KEY_GRACE_MS) return;
    stop();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && root.childElementCount > 0) stop();
  };
  doc.addEventListener('keydown', onKey);
  let shown = false;
  let alive = true;
  // textContent only (the device's name is whatever it claimed), and only when it changed
  const put = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };
  const show = (c: PowerCountdown | null) => {
    if (!alive) return;
    if (!c) {
      root.replaceChildren();
      shown = false;
      return;
    }
    put(sentence, c.text);
    put(note, c.note);
    put(button, c.cancel);
    doc.documentElement.lang = c.lang;
    if (!shown) {
      put(live, c.text);
      root.replaceChildren(live, sentence, note, button);
      shown = true;
      shownAt = clock();
      // the button that stops is the one a key press reaches first
      button.focus();
    }
  };
  const read = () =>
    api
      .status()
      .then(show)
      .catch(() => undefined);
  void read();
  const timer = setInterval(read, READ_EVERY_MS);
  return () => {
    alive = false;
    clearInterval(timer);
    doc.removeEventListener('keydown', onKey);
  };
}
