/** Takes one frame of what the user picks (screen, window or tab) and returns it as a PNG. Nothing is stored or sent. */

/** Grabs a single frame of the chosen source; the stream is stopped right away. */
export async function captureFrame(): Promise<{ blob: Blob; width: number; height: number }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
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

/** Puts a PNG on the clipboard; false when the browser does not allow it. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
