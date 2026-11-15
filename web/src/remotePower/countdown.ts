import type { PowerCountdown } from '@/core/platform/tauri/remotePower';

/** How often the window reads the countdown. The number changes once a second. */
export const READ_EVERY_MS = 250;

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
export function mountCountdown(root: HTMLElement, api: CountdownApi): () => void {
  const doc = root.ownerDocument;
  const sentence = doc.createElement('p');
  sentence.className = 'sentence';
  sentence.setAttribute('role', 'status');
  sentence.setAttribute('aria-live', 'polite');
  const note = doc.createElement('p');
  note.className = 'note';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'cancel';
  button.dataset.testid = 'power-cancel';
  button.addEventListener('click', () => {
    button.disabled = true;
    void api.cancel().finally(() => {
      button.disabled = false;
    });
  });
  let shown = false;
  let alive = true;
  const show = (c: PowerCountdown | null) => {
    if (!alive) return;
    if (!c) {
      root.replaceChildren();
      shown = false;
      return;
    }
    // textContent only: the device's name is whatever it claimed
    sentence.textContent = c.text;
    note.textContent = c.note;
    button.textContent = c.cancel;
    doc.documentElement.lang = c.lang;
    if (!shown) {
      root.replaceChildren(sentence, note, button);
      shown = true;
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
  };
}
