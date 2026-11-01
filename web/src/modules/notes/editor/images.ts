import { getBlob, putBlob } from '@/core/blobs';
import { randomId } from '@/core/db/util';

export const IMAGE_SCHEME = 'nemo-img:';
const MAX_EDGE = 2000;

export const imageKey = (src: string): string | undefined =>
  src.startsWith(IMAGE_SCHEME) ? `notes:img:${src.slice(IMAGE_SCHEME.length)}` : undefined;

/** Scales a picture down to at most 2000 px (WebP when the browser can) before it is stored. */
async function shrink(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

/** Stores the picture on this device only (`_blobs`, not synced) and returns its `nemo-img:` source. */
export async function storeImage(file: Blob): Promise<string> {
  const id = randomId();
  await putBlob(`notes:img:${id}`, await shrink(file));
  return `${IMAGE_SCHEME}${id}`;
}

export async function loadImage(src: string): Promise<Blob | undefined> {
  const key = imageKey(src);
  return key ? getBlob(key) : undefined;
}
