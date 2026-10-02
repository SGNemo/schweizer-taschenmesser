// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() =>
  vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
);
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { createDesktopService } from './desktop';

beforeEach(() => invoke.mockReset());

describe('desktop service', () => {
  it('is inert when unsupported', async () => {
    const d = createDesktopService(false);
    expect(d.supported).toBe(false);
    await d.setCloseToTray(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sets and clears the hotkey', async () => {
    const d = createDesktopService(true);
    expect(await d.setHotkey('Ctrl+Shift+Space')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('capture_set_hotkey', { accelerator: 'Ctrl+Shift+Space' });
    await d.setHotkey(null);
    expect(invoke).toHaveBeenLastCalledWith('capture_set_hotkey', { accelerator: null });
  });

  it('registers the vault search key through its own command', async () => {
    const d = createDesktopService(true);
    expect(await d.setVaultHotkey('Ctrl+Alt+V')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('desktop_set_vault_hotkey', { accelerator: 'Ctrl+Alt+V' });
    invoke.mockRejectedValueOnce('taken');
    expect(await d.setVaultHotkey('Ctrl+Alt+V')).toBe('taken');
  });

  it('maps registration failures to codes and never throws', async () => {
    const d = createDesktopService(true);
    invoke.mockRejectedValueOnce('taken');
    expect(await d.setHotkey('Ctrl+Alt+K')).toBe('taken');
    invoke.mockRejectedValueOnce('invalid');
    expect(await d.setHotkey('nonsense')).toBe('invalid');
    invoke.mockRejectedValueOnce(new Error('boom'));
    expect(await d.setHotkey('Ctrl+K')).toBe('failed');
  });

  it('passes toggles, labels and autostart to the shell', async () => {
    const d = createDesktopService(true);
    await d.setCloseToTray(true);
    await d.setAutostart(true);
    await d.setTrayLabels({ capture: 'a', open: 'b', quit: 'c', tooltip: 'd' });
    expect(invoke.mock.calls.map((c) => c[0])).toEqual([
      'desktop_set_close_to_tray',
      'desktop_set_autostart',
      'desktop_set_tray_labels',
    ]);
  });

  it('turns a missing clipboard into undefined', async () => {
    const d = createDesktopService(true);
    invoke.mockResolvedValueOnce(null);
    expect(await d.readClipboard()).toBeUndefined();
    invoke.mockResolvedValueOnce('Hallo');
    expect(await d.readClipboard()).toBe('Hallo');
  });

  it('forwards the capture-open DOM event', () => {
    const d = createDesktopService(true);
    const cb = vi.fn();
    const off = d.onCaptureOpen(cb);
    window.dispatchEvent(new Event('tm-capture-open'));
    off();
    window.dispatchEvent(new Event('tm-capture-open'));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
