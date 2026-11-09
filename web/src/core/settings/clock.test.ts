// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CLOCK_KEY, clockDefault, readClockOn, setClockOn } from './clock';

describe('clock setting', () => {
  afterEach(() => localStorage.clear());

  it('is on in the desktop app and off on Android and in the PWA by default', () => {
    expect(clockDefault('desktop')).toBe(true);
    expect(clockDefault('android')).toBe(false);
    expect(clockDefault('web')).toBe(false);
    expect(readClockOn('desktop')).toBe(true);
    expect(readClockOn('web')).toBe(false);
  });

  it('stores only a choice that differs from the default', () => {
    setClockOn(false, 'desktop');
    expect(localStorage.getItem(CLOCK_KEY)).toBe('0');
    expect(readClockOn('desktop')).toBe(false);
    setClockOn(true, 'desktop');
    expect(localStorage.getItem(CLOCK_KEY)).toBeNull();
    setClockOn(true, 'web');
    expect(localStorage.getItem(CLOCK_KEY)).toBe('1');
    expect(readClockOn('web')).toBe(true);
  });
});
