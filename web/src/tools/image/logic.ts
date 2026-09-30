export type OutType = 'image/png' | 'image/jpeg' | 'image/webp';

export const FORMATS: readonly { type: OutType; label: string; ext: string; lossy: boolean }[] = [
  { type: 'image/webp', label: 'WebP', ext: 'webp', lossy: true },
  { type: 'image/jpeg', label: 'JPG', ext: 'jpg', lossy: true },
  { type: 'image/png', label: 'PNG', ext: 'png', lossy: false },
];

export const formatOf = (type: OutType) => FORMATS.find((f) => f.type === type)!;

/** Scales `w × h` down so the longer side is at most `maxSide`; never enlarges. No limit → unchanged. */
export function fitSize(
  w: number,
  h: number,
  maxSide: number | undefined,
): { w: number; h: number } {
  if (!maxSide || !(maxSide >= 1) || Math.max(w, h) <= maxSide) return { w, h };
  const k = maxSide / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export type CropRatio = 'none' | '1:1' | '4:3' | '3:2' | '16:9' | '3:4' | '2:3' | '9:16';
export const CROP_RATIOS: readonly CropRatio[] = [
  'none',
  '1:1',
  '4:3',
  '3:2',
  '16:9',
  '3:4',
  '2:3',
  '9:16',
];

/** The largest centred rectangle of the given aspect ratio inside `w × h` (whole pixels). */
export function cropRect(
  w: number,
  h: number,
  ratio: CropRatio,
): { x: number; y: number; w: number; h: number } {
  if (ratio === 'none') return { x: 0, y: 0, w, h };
  const [a, b] = ratio.split(':').map(Number) as [number, number];
  const target = a / b;
  let cw = w;
  let ch = Math.round(w / target);
  if (ch > h) {
    ch = h;
    cw = Math.round(h * target);
  }
  return {
    x: Math.floor((w - cw) / 2),
    y: Math.floor((h - ch) / 2),
    w: Math.max(1, cw),
    h: Math.max(1, ch),
  };
}

/** `Urlaub.HEIC` → `Urlaub-klein.webp` */
export function outName(name: string, type: OutType): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'bild';
  return `${base}-klein.${formatOf(type).ext}`;
}

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024)} KB`;
  return `${nf.format(bytes / 1024 / 1024)} MB`;
}
