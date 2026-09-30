import { cropRect, fitSize, type CropRatio, type OutType } from './logic';

export interface ConvertOptions {
  type: OutType;
  /** 0.4–1 for JPG/WebP. */
  quality: number;
  maxSide: number | undefined;
  crop: CropRatio;
}

export interface Converted {
  blob: Blob;
  width: number;
  height: number;
}

/** Reads the picture (rotated as its EXIF says) without showing it. Throws if the browser cannot decode it. */
export const decode = (file: Blob): Promise<ImageBitmap> =>
  createImageBitmap(file, { imageOrientation: 'from-image' });

/** Crops, scales and re-encodes in a canvas: nothing leaves the device. */
export async function convert(bitmap: ImageBitmap, o: ConvertOptions): Promise<Converted> {
  const c = cropRect(bitmap.width, bitmap.height, o.crop);
  const { w, h } = fitSize(c.w, c.h, o.maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  if (o.type === 'image/jpeg') {
    // JPG has no transparency: paint white first instead of black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, c.x, c.y, c.w, c.h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, o.type, o.quality),
  );
  // A browser that cannot write the format silently falls back to PNG: treat that as a failure.
  if (!blob || blob.type !== o.type) throw new Error('encode');
  return { blob, width: w, height: h };
}
