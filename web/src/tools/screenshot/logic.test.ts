import { describe, expect, it } from 'vitest';
import { canCaptureScreen, classifyCaptureError, screenshotFileName } from './logic';

describe('screenshot tool logic', () => {
  it('knows whether the device can capture a screen', () => {
    expect(canCaptureScreen({ mediaDevices: { getDisplayMedia: () => undefined } })).toBe(true);
    expect(canCaptureScreen({ mediaDevices: {} })).toBe(false);
    expect(canCaptureScreen({})).toBe(false);
  });

  it('names the file after the local day and time', () => {
    expect(screenshotFileName(new Date(2026, 8, 29, 9, 5))).toBe(
      'bildschirmfoto-2026-09-29-0905.png',
    );
    expect(screenshotFileName(new Date(2026, 11, 1, 23, 59))).toBe(
      'bildschirmfoto-2026-12-01-2359.png',
    );
  });

  it('treats a dismissed picker as "nothing taken", everything else as a failure', () => {
    expect(classifyCaptureError({ name: 'NotAllowedError' })).toBe('cancelled');
    expect(classifyCaptureError({ name: 'AbortError' })).toBe('cancelled');
    expect(classifyCaptureError({ name: 'NotSupportedError' })).toBe('unsupported');
    expect(classifyCaptureError({ name: 'NotReadableError' })).toBe('failed');
    expect(classifyCaptureError(new Error('no-frame'))).toBe('failed');
    expect(classifyCaptureError(undefined)).toBe('failed');
  });
});
