// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGameSettings,
  isGamingNow,
  onGameModeChange,
  quietChannelWanted,
  setGameSettings,
  type GameSettings,
} from './gameMode';

const settings = (patch: Partial<GameSettings> = {}): GameSettings => ({
  mode: 'auto',
  sound: 'soft',
  volume: 40,
  ...patch,
});

beforeEach(() => localStorage.clear());

describe('game mode settings', () => {
  it('start on automatic on the desktop and off elsewhere', () => {
    expect(getGameSettings('desktop')).toEqual(settings());
    expect(getGameSettings('android').mode).toBe('off');
    expect(getGameSettings('web').mode).toBe('off');
  });

  it('are kept on the device and announce a change', () => {
    const changed = vi.fn();
    const stop = onGameModeChange(changed);
    setGameSettings({ mode: 'on', sound: 'bell', volume: 70 }, 'desktop');
    expect(getGameSettings('desktop')).toEqual({ mode: 'on', sound: 'bell', volume: 70 });
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    setGameSettings({ mode: 'off' }, 'desktop');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('fall back to the defaults for damaged storage and clamp the volume', () => {
    localStorage.setItem('tm-game-mode', '{nope');
    expect(getGameSettings('desktop')).toEqual(settings());
    localStorage.setItem('tm-game-mode', JSON.stringify({ mode: 'x', sound: 'y', volume: 900 }));
    expect(getGameSettings('desktop')).toEqual(settings({ volume: 100 }));
  });
});

describe('isGamingNow', () => {
  const detect = (answer: boolean) => vi.fn(async () => answer);

  it('follows the detection in automatic mode, on the desktop only', async () => {
    expect(await isGamingNow({ kind: 'desktop', settings: settings(), detect: detect(true) })).toBe(
      true,
    );
    expect(
      await isGamingNow({ kind: 'desktop', settings: settings(), detect: detect(false) }),
    ).toBe(false);
    expect(await isGamingNow({ kind: 'android', settings: settings(), detect: detect(true) })).toBe(
      false,
    );
    expect(await isGamingNow({ kind: 'desktop', settings: settings() })).toBe(false);
  });

  it('the manual switch holds without asking the detection', async () => {
    const d = detect(false);
    expect(await isGamingNow({ kind: 'web', settings: settings({ mode: 'on' }), detect: d })).toBe(
      true,
    );
    expect(d).not.toHaveBeenCalled();
  });

  it('off never asks and never plays; a failing detection counts as not gaming', async () => {
    const d = detect(true);
    expect(
      await isGamingNow({ kind: 'desktop', settings: settings({ mode: 'off' }), detect: d }),
    ).toBe(false);
    expect(d).not.toHaveBeenCalled();
    const broken = vi.fn(async () => {
      throw new Error('no');
    });
    expect(await isGamingNow({ kind: 'desktop', settings: settings(), detect: broken })).toBe(
      false,
    );
  });
});

describe('quietChannelWanted', () => {
  it('is the manual switch on a device without a tone', () => {
    expect(quietChannelWanted('android', settings({ mode: 'on' }))).toBe(true);
    expect(quietChannelWanted('web', settings({ mode: 'on' }))).toBe(true);
    expect(quietChannelWanted('android', settings({ mode: 'auto' }))).toBe(false);
    expect(quietChannelWanted('desktop', settings({ mode: 'on' }))).toBe(false);
  });
});
