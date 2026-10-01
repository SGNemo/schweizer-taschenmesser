// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform, type DesktopService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_HOTKEY, DEFAULT_PREFS, readPrefs, writePrefs } from './device';
import { hotkeyLabel, startQuickCaptureDesktop } from './desktop';

const fakeDesktop = (over: Partial<DesktopService> = {}): DesktopService => ({
  ...createWebPlatform().desktop,
  supported: true,
  setHotkey: vi.fn(async () => null),
  setCloseToTray: vi.fn(async () => undefined),
  setTrayLabels: vi.fn(async () => undefined),
  setAutostart: vi.fn(async () => undefined),
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setPlatform(undefined));

describe('device prefs', () => {
  it('defaults everything risky to off', () => {
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toMatchObject({ closeToTray: false, autostart: false, clipboard: false });
    expect(DEFAULT_PREFS.hotkey).toBe(DEFAULT_HOTKEY);
  });

  it('persists a patch and survives broken storage content', () => {
    writePrefs({ closeToTray: true });
    expect(readPrefs().closeToTray).toBe(true);
    localStorage.setItem('tm-quick-capture', '{nope');
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe('hotkeyLabel', () => {
  it('shows German key names', () => {
    expect(hotkeyLabel('Ctrl+Shift+Space')).toBe('Strg+Umschalt+Leertaste');
    expect(hotkeyLabel('Alt+K')).toBe('Alt+K');
  });
});

describe('startQuickCaptureDesktop', () => {
  it('does nothing outside the desktop app', async () => {
    const d = fakeDesktop({ supported: false });
    setPlatform({ ...createWebPlatform(), desktop: d });
    await startQuickCaptureDesktop();
    expect(d.setHotkey).not.toHaveBeenCalled();
  });

  it('applies the stored switches and registers the default hotkey', async () => {
    const d = fakeDesktop();
    setPlatform({ ...createWebPlatform(), desktop: d });
    writePrefs({ closeToTray: true, autostart: true });
    await startQuickCaptureDesktop();
    expect(d.setTrayLabels).toHaveBeenCalled();
    expect(d.setCloseToTray).toHaveBeenCalledWith(true);
    expect(d.setAutostart).toHaveBeenCalledWith(true);
    expect(d.setHotkey).toHaveBeenCalledWith('Ctrl+Shift+Space');
  });

  it('does not touch autostart when it is off', async () => {
    const d = fakeDesktop();
    setPlatform({ ...createWebPlatform(), desktop: d });
    await startQuickCaptureDesktop();
    expect(d.setAutostart).not.toHaveBeenCalled();
  });

  it('tells the user when the hotkey is taken', async () => {
    const d = fakeDesktop({ setHotkey: vi.fn(async () => 'taken' as const) });
    setPlatform({ ...createWebPlatform(), desktop: d });
    await startQuickCaptureDesktop();
    expect(useUiStore.getState().toasts[0]?.message).toContain('Strg+Umschalt+Leertaste');
  });
});
