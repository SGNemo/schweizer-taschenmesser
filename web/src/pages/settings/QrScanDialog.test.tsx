// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const decode = vi.hoisted(() =>
  vi.fn<(data: Uint8ClampedArray, w: number, h: number) => { data: string } | null>(() => null),
);
vi.mock('jsqr', () => ({ default: decode }));

import { QrScanDialog } from './QrScanDialog';

const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

function camera(get: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(get) },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  stopTrack.mockReset();
  decode.mockReset().mockReturnValue(null);
  // jsdom has no video decoding and no canvas: a ready 1280×720 frame of nothing
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 4,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 1280,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 720,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: () => undefined,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
      }) as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('QrScanDialog (phone camera in the app)', () => {
  it('reads a code from the camera, hands it over once and turns the camera off', async () => {
    camera(async () => stream);
    const onResult = vi.fn();
    render(<QrScanDialog onResult={onResult} onCancel={vi.fn()} onFailure={vi.fn()} />);
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(onResult).not.toHaveBeenCalled();

    decode.mockReturnValue({ data: 'NEMO1:abc' });
    await act(async () => vi.advanceTimersByTimeAsync(450));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('NEMO1:abc');
    expect(stopTrack).toHaveBeenCalled();
    // frames are scaled down before decoding (never the full sensor size)
    expect(decode.mock.calls.at(-1)?.slice(1, 3)).toEqual([720, 405]);
  });

  it('a refused camera is "camera-denied", never a crash', async () => {
    camera(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    const onFailure = vi.fn();
    render(<QrScanDialog onResult={vi.fn()} onCancel={vi.fn()} onFailure={onFailure} />);
    await flush();
    expect(onFailure).toHaveBeenCalledWith('camera-denied');
  });

  it('a PC without a webcam is "no-camera" (NotFoundError), and the webcam hint replaces the phone line', async () => {
    camera(async () => {
      throw new DOMException('no device', 'NotFoundError');
    });
    const onFailure = vi.fn();
    render(
      <QrScanDialog
        hint="Richte die Webcam auf den QR-Code am anderen PC."
        onResult={vi.fn()}
        onCancel={vi.fn()}
        onFailure={onFailure}
      />,
    );
    expect(screen.getByText('Richte die Webcam auf den QR-Code am anderen PC.')).toBeTruthy();
    await flush();
    expect(onFailure).toHaveBeenCalledWith('no-camera');
  });

  it('"Abbrechen" closes it and the camera goes off; a late camera is stopped too', async () => {
    let give: (s: MediaStream) => void = () => undefined;
    camera(() => new Promise((r) => (give = r)));
    const onCancel = vi.fn();
    const onFailure = vi.fn();
    const { unmount } = render(
      <QrScanDialog onResult={vi.fn()} onCancel={onCancel} onFailure={onFailure} />,
    );
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onCancel).toHaveBeenCalled();
    unmount();
    give(stream);
    await flush();
    expect(stopTrack).toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
