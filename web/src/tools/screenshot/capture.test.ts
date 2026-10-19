// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canShareImage, captureFrame, copyImage, shareImage } from './capture';

const stop = vi.fn();
const draw = vi.fn();
const png = new Blob(['png'], { type: 'image/png' });
let toBlob: (cb: BlobCallback, type?: string) => void;

/** jsdom has no video or canvas: stand-ins that behave like a 640 × 360 frame. */
function mockDom(videoWidth = 640, videoHeight = 360) {
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'video')
      return {
        muted: false,
        srcObject: null,
        play: async () => undefined,
        videoWidth,
        videoHeight,
      };
    if (tag === 'canvas')
      return { width: 0, height: 0, getContext: () => ({ drawImage: draw }), toBlob };
    return real(tag);
  }) as typeof document.createElement);
}

beforeEach(() => {
  stop.mockClear();
  draw.mockClear();
  toBlob = (cb) => cb(png);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getDisplayMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    configurable: true,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('captureFrame', () => {
  it('draws one frame on a canvas, returns it as a PNG and stops the stream', async () => {
    mockDom();
    const frame = await captureFrame();
    expect(frame).toEqual({ blob: png, width: 640, height: 360 });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 360);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    });
  });

  it('fails (and still stops the stream) when no frame ever arrives', async () => {
    vi.useFakeTimers();
    mockDom(0, 0);
    const result = captureFrame();
    const settled = expect(result).rejects.toThrow('no-frame');
    await vi.advanceTimersByTimeAsync(2000);
    await settled;
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('fails when the PNG cannot be encoded', async () => {
    mockDom();
    toBlob = (cb) => cb(null);
    await expect(captureFrame()).rejects.toThrow('encode');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('counts 3, 2, 1 after the source is picked, then takes the frame', async () => {
    vi.useFakeTimers();
    mockDom();
    const ticks: number[] = [];
    const result = captureFrame({ delaySeconds: 3, onTick: (n) => ticks.push(n) });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toMatchObject({ width: 640 });
    expect(ticks).toEqual([3, 2, 1]);
  });

  it('stops with AbortError when cancelled during the wait', async () => {
    vi.useFakeTimers();
    mockDom();
    const result = captureFrame({ delaySeconds: 3, cancelled: () => true });
    const settled = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
    expect(draw).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('copyImage / shareImage', () => {
  it('copies as image/png and reports a refusal as false', async () => {
    const write = vi.fn(async () => undefined);
    class Item {
      constructor(public data: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', Item);
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    expect(await copyImage(png)).toBe(true);
    expect((write.mock.calls[0] as unknown as [Item[]])[0][0]!.data['image/png']).toBe(png);
    write.mockRejectedValueOnce(new Error('denied'));
    expect(await copyImage(png)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('shares a file only where the device can, a dismissed sheet is false', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    expect(canShareImage()).toBe(false);
    expect(await shareImage(png, 'a.png')).toBe(false);

    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    expect(canShareImage()).toBe(true);
    expect(await shareImage(png, 'a.png')).toBe(true);
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]!.name).toBe('a.png');
    share.mockRejectedValueOnce(new DOMException('x', 'AbortError'));
    expect(await shareImage(png, 'a.png')).toBe(false);
  });
});
