import { useEffect, useState } from 'react';

/**
 * Cover tone: the dominant, pleasantly saturated colour of a cover image, for the head of the music module and
 * its widget. Pure function over sampled pixels (testable) plus a hook that samples a small canvas once per picture
 * and caches the result. Nothing leaves the device; failures give `undefined` and the module hue stays.
 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Bucketed average, weighting saturated mid-tones so a black/white border does not win. */
export function dominantColor(pixels: Uint8ClampedArray | readonly number[]): Rgb | undefined {
  const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    if (pixels[i + 3]! < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 510;
    const sat = max === 0 ? 0 : (max - min) / max;
    // Too dark, too bright or grey pixels barely count.
    const weight = (1 - Math.abs(light - 0.5) * 1.6) * (0.15 + sat);
    if (weight <= 0.05) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
    cur.r += r * weight;
    cur.g += g * weight;
    cur.b += b * weight;
    cur.w += weight;
    buckets.set(key, cur);
  }
  let best: { r: number; g: number; b: number; w: number } | undefined;
  for (const bucket of buckets.values()) if (!best || bucket.w > best.w) best = bucket;
  if (!best) return undefined;
  return {
    r: Math.round(best.r / best.w),
    g: Math.round(best.g / best.w),
    b: Math.round(best.b / best.w),
  };
}

export const toCss = ({ r, g, b }: Rgb): string => `rgb(${r} ${g} ${b})`;

const cache = new Map<string, Rgb | null>();
const MAX_CACHE = 64;

async function sample(src: string): Promise<Rgb | undefined> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(img, 0, 0, size, size);
  return dominantColor(ctx.getImageData(0, 0, size, size).data);
}

/** The tone of a local (`blob:`/`data:`) image, cached by `key` (the cover's id or URL). */
export function useCoverTone(src: string | undefined, key: string | undefined): Rgb | undefined {
  const [tone, setTone] = useState<{ key: string; rgb: Rgb | undefined }>();
  const cached = key ? cache.get(key) : undefined;
  useEffect(() => {
    if (!src || !key || cache.has(key)) return;
    let alive = true;
    void sample(src)
      .catch(() => undefined)
      .then((rgb) => {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
        cache.set(key, rgb ?? null);
        if (alive) setTone({ key, rgb });
      });
    return () => {
      alive = false;
    };
  }, [src, key]);
  if (cached) return cached;
  return tone && tone.key === key ? tone.rgb : undefined;
}

/** Test helper. */
export function clearCoverToneCache(): void {
  cache.clear();
}

const hex = (value: string): Rgb | undefined => {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return undefined;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const blend = (fg: Rgb, bg: Rgb, alpha: number): Rgb => ({
  r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
  g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
  b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
});

/**
 * How strongly a cover colour may tint the head: the largest share (≤ `max`) over the surface that still keeps `text` at
 * AA (4.5:1). A bright cover in the dark theme gets a weaker tint, a dark one a stronger; unknown token formats fall back
 * to a mild, always-safe share.
 */
export function safeTint(tone: Rgb, surface: string, text: string, max = 0.55): number {
  const bg = hex(surface);
  const fg = hex(text);
  if (!bg || !fg) return Math.min(max, 0.25);
  for (let a = max; a > 0.04; a -= 0.03)
    if (contrast(fg, blend(tone, bg, a)) >= 4.5) return Math.round(a * 100) / 100;
  return 0;
}
