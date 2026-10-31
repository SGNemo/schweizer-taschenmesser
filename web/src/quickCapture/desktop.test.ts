// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform, type DesktopService } from '@/core/platform';
import type { TrayToday } from '@/core/platform/types';
import { createWebPlatform } from '@/core/platform/web';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_HOTKEY, DEFAULT_PREFS, readPrefs, writePrefs } from './device';
import { clearAll } from '@/core/ai/testing';
import { TRAY_ITEM_EVENT } from '@/core/platform/tauri/traySnapshot';
import { setNow } from '@/core/time/now';
import { useTimer } from '@/tools/timer/engine';
import { isRunning } from '@/tools/timer/logic';
import { saveCapture } from './targets';
import { hotkeyLabel, startQuickCaptureDesktop, startTrayTimer, startTrayToday } from './desktop';

const fakeDesktop = (over: Partial<DesktopService> = {}): DesktopService => ({
  ...createWebPlatform().desktop,
  supported: true,
  setHotkey: vi.fn(async () => null),
  setVaultHotkey: vi.fn(async () => null),
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

  it('leaves the vault search key off unless the user set one', async () => {
    const d = fakeDesktop();
    setPlatform({ ...createWebPlatform(), desktop: d });
    await startQuickCaptureDesktop();
    expect(d.setVaultHotkey).not.toHaveBeenCalled();
    writePrefs({ vaultHotkey: 'Ctrl+Alt+V' });
    await startQuickCaptureDesktop();
    expect(d.setVaultHotkey).toHaveBeenCalledWith('Ctrl+Alt+V');
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

describe('tray "Heute"', () => {
  it('is on by default and can be switched off per device', () => {
    expect(DEFAULT_PREFS.trayToday).toBe(true);
    writePrefs({ trayToday: false });
    expect(readPrefs().trayToday).toBe(false);
  });

  it('"Timer 25 Minuten" starts a 25-minute timer and shows it, but never resets a running one', () => {
    useTimer.getState().reset();
    startTrayTimer();
    const st = useTimer.getState();
    expect(st.mode).toBe('timer');
    expect(isRunning(st.timer)).toBe(true);
    expect(st.timer.durationMs).toBe(25 * 60_000);
    expect(useUiStore.getState()).toMatchObject({ toolsOpen: true, activeTool: 'timer' });
    const endAt = st.timer.endAt;
    startTrayTimer();
    expect(useTimer.getState().timer.endAt).toBe(endAt);
    useTimer.getState().pause();
    useTimer.getState().reset();
    useUiStore.getState().closeTools();
  });

  it('shows today in the tray and opens the clicked line', async () => {
    setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
    await clearAll();
    await saveCapture('event', { title: 'Zahnarzt', date: '2026-09-30', time: '15:00' });
    const setTrayToday = vi.fn(async (_today: TrayToday) => undefined);
    const stop = await startTrayToday(fakeDesktop({ setTrayToday }));
    await vi.waitFor(() =>
      expect(setTrayToday).toHaveBeenCalledWith(
        expect.objectContaining({ items: ['15:00 · Zahnarzt'] }),
      ),
    );
    window.dispatchEvent(new CustomEvent(TRAY_ITEM_EVENT, { detail: 'today-0' }));
    expect(location.pathname).toBe('/calendar');
    stop();
    setNow();
  });
});
