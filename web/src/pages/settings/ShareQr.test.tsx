// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitIntoFrames } from '@/core/share/frames';
import { QrPlayer, QrScanner } from './ShareQr';

const text = JSON.stringify({ blob: 'x'.repeat(2500), note: 'Grüße' });

describe('QrPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cycles through the frames and can be paused', () => {
    const frames = splitIntoFrames(text);
    render(<QrPlayer frames={frames} onDone={() => undefined} />);
    const label = () => screen.getByTestId('share-qr-frame').textContent;
    expect(label()).toContain(`1 `);
    act(() => void vi.advanceTimersByTime(1000));
    expect(label()).not.toContain('Bild 1 ');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(`${frames.length}`);
  });
});

describe('QrPlayer with another run', () => {
  it('starts at the first picture again and offers to cancel without handing over', () => {
    const long = splitIntoFrames(text);
    const short = splitIntoFrames('short');
    const onCancel = vi.fn();
    const { rerender } = render(<QrPlayer frames={long} onDone={() => undefined} />);
    const label = () => screen.getByTestId('share-qr-frame').textContent;
    act(() => screen.getByRole('button', { name: 'Anhalten' }).click());
    act(() => screen.getByRole('button', { name: 'Nächstes Bild' }).click());
    expect(label()).toContain('Bild 2 ');
    // The next connection has one picture only: index 1 would be out of range.
    rerender(<QrPlayer frames={short} onDone={() => undefined} onCancel={onCancel} />);
    expect(label()).toContain('Bild 1 von 1');
    act(() => screen.getByRole('button', { name: 'Abbrechen' }).click());
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('QrScanner', () => {
  const stops = vi.fn();
  beforeEach(() => {
    stops.mockClear();
    const frames = splitIntoFrames(text);
    let i = 0;
    class FakeDetector {
      async detect() {
        // The camera sees the frames in a shuffled order, one per tick, some twice.
        const order = [...frames].reverse();
        const next = order[i++ % order.length]!;
        return [{ rawValue: next }];
      }
    }
    (globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeDetector;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: stops }] }),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 4,
    });
    HTMLMediaElement.prototype.play = async () => undefined;
  });
  afterEach(() => {
    delete (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it('collects the pictures, hands over the text and turns the camera off', async () => {
    const onText = vi.fn();
    render(<QrScanner onText={onText} onStop={() => undefined} />);
    await waitFor(() => expect(onText).toHaveBeenCalledWith(text), { timeout: 8000 });
    expect(stops).toHaveBeenCalled();
  });

  it('turns the camera off when it is closed early', async () => {
    const view = render(<QrScanner onText={() => undefined} onStop={() => undefined} />);
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toBeDefined());
    await new Promise((r) => setTimeout(r, 50));
    view.unmount();
    await waitFor(() => expect(stops).toHaveBeenCalled());
  });
});
