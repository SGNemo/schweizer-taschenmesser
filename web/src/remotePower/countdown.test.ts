// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PowerCountdown } from '@/core/platform/tauri/remotePower';
import { KEY_GRACE_MS, mountCountdown, READ_EVERY_MS } from './countdown';

afterEach(() => vi.useRealTimers());

const at = (seconds: number, text?: string): PowerCountdown => ({
  text: text ?? `Svens Handy schaltet diesen PC in ${seconds} Sekunden aus.`,
  note: 'Fragt ein Programm noch nach dem Speichern, wartet Windows auf dich.',
  cancel: 'Abbrechen',
  lang: 'de',
});

describe('power countdown window', () => {
  it('shows the sentence the PC words, follows it, and stops on one button', async () => {
    vi.useFakeTimers();
    let current: PowerCountdown | null = at(10);
    const api = {
      status: vi.fn(async () => current),
      cancel: vi.fn(async () => {
        current = null;
      }),
    };
    const root = document.createElement('div');
    document.body.append(root);
    let t = 0;
    const stop = mountCountdown(root, api, () => t);
    await vi.advanceTimersByTimeAsync(0);
    t = KEY_GRACE_MS;
    expect(root.querySelector('.sentence')?.textContent).toBe(
      'Svens Handy schaltet diesen PC in 10 Sekunden aus.',
    );
    // screen readers hear it once, and the button is described by it
    expect(root.querySelector('[role="status"]')?.textContent).toContain('10 Sekunden');
    const button = root.querySelector('button')!;
    expect(button.textContent).toBe('Abbrechen');
    expect(document.activeElement).toBe(button);
    // calm: no bar, no animation element
    expect(root.querySelector('progress, [role="progressbar"]')).toBeNull();
    current = at(3);
    await vi.advanceTimersByTimeAsync(READ_EVERY_MS);
    expect(root.querySelector('.sentence')?.textContent).toContain('in 3 Sekunden');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('10 Sekunden');
    expect(button.getAttribute('aria-describedby')).toBe('power-sentence');
    button.click();
    expect(api.cancel).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(READ_EVERY_MS);
    expect(root.childElementCount).toBe(0);
    stop();
    root.remove();
  });

  it('Escape stops it; a key press right as it appeared does not', async () => {
    vi.useFakeTimers();
    let t = 0;
    const api = { status: async () => at(9), cancel: vi.fn(async () => undefined) };
    const root = document.createElement('div');
    document.body.append(root);
    const stop = mountCountdown(root, api, () => t);
    await vi.advanceTimersByTimeAsync(0);
    const button = root.querySelector('button')!;
    // Enter/Space on a focused button is a click without a pointer (detail 0)
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(api.cancel).not.toHaveBeenCalled();
    t = KEY_GRACE_MS;
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(api.cancel).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(api.cancel).toHaveBeenCalledTimes(2);
    stop();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(api.cancel).toHaveBeenCalledTimes(2);
    root.remove();
  });

  it('never reads a name as markup', async () => {
    vi.useFakeTimers();
    const api = {
      status: async () =>
        at(5, '<img src=x onerror=alert(1)> schaltet diesen PC in 5 Sekunden aus.'),
      cancel: async () => undefined,
    };
    const root = document.createElement('div');
    const stop = mountCountdown(root, api);
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('img')).toBeNull();
    stop();
  });

  it('shows nothing while no countdown runs', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const stop = mountCountdown(root, { status: async () => null, cancel: async () => undefined });
    await vi.advanceTimersByTimeAsync(READ_EVERY_MS);
    expect(root.childElementCount).toBe(0);
    stop();
  });
});
