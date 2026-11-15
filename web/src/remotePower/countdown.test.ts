// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PowerCountdown } from '@/core/platform/tauri/remotePower';
import { mountCountdown, READ_EVERY_MS } from './countdown';

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
    const stop = mountCountdown(root, api);
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'Svens Handy schaltet diesen PC in 10 Sekunden aus.',
    );
    const button = root.querySelector('button')!;
    expect(button.textContent).toBe('Abbrechen');
    expect(document.activeElement).toBe(button);
    // calm: no bar, no animation element
    expect(root.querySelector('progress, [role="progressbar"]')).toBeNull();
    current = at(3);
    await vi.advanceTimersByTimeAsync(READ_EVERY_MS);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('in 3 Sekunden');
    button.click();
    expect(api.cancel).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(READ_EVERY_MS);
    expect(root.childElementCount).toBe(0);
    stop();
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
