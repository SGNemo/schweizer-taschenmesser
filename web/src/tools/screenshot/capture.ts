/** Takes one frame of what the user picks (screen, window or tab) and returns it as a PNG. Nothing is stored or sent. */

export interface CaptureOptions {
  /** Wait this many whole seconds after the source is picked, so the user can switch to it. */
  delaySeconds?: number;
  /** Called with the seconds still to wait (3, 2, 1). */
  onTick?: (secondsLeft: number) => void;
  /** Checked while waiting; `true` stops the capture with an `AbortError`. */
  cancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Grabs a single frame of the chosen source; the stream is stopped right away. */
export async function captureFrame(
  options: CaptureOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    for (let left = options.delaySeconds ?? 0; left > 0; left--) {
      options.onTick?.(left);
      await sleep(1000);
      if (options.cancelled?.()) throw new DOMException('cancelled', 'AbortError');
    }
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    // The first frame can be empty; wait for one with a size.
    for (let i = 0; i < 20 && video.videoWidth === 0; i++)
      await new Promise((r) => setTimeout(r, 50));
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error('no-frame');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'),
    );
    return { blob, width, height };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/** Shares the PNG as a file where the device can (phones, some desktops); false when it cannot or the user dismissed the sheet. */
export async function shareImage(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] }))
    return false;
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** True where a PNG can be shared as a file. */
export function canShareImage(): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/** Puts a PNG on the clipboard; false when the browser does not allow it. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
