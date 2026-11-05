import type { FileKind } from '@/core/platform/disk';

/** Pattern per file type, so the legend and the map never rely on colour alone. */
export type PatternId =
  'diagonal' | 'dots' | 'vertical' | 'cross' | 'horizontal' | 'backdiagonal' | 'grid' | 'none';

export const KIND_PATTERN: Record<FileKind, PatternId> = {
  video: 'diagonal',
  image: 'dots',
  audio: 'vertical',
  archive: 'cross',
  program: 'horizontal',
  document: 'backdiagonal',
  game: 'grid',
  other: 'none',
};

/** CSS custom properties (`components/Palette.module.css`, mapped onto `--mod-*` tokens) holding the fill colours. */
export const KIND_VAR: Record<FileKind, string> = {
  video: '--k-video',
  image: '--k-image',
  audio: '--k-audio',
  archive: '--k-archive',
  program: '--k-program',
  document: '--k-document',
  game: '--k-game',
  other: '--k-other',
};

/**
 * A computed CSS colour as `#rrggbb`: `rgb()`/`rgba()` (alpha ignored), `color(srgb r g b)` (how browsers
 * serialise `color-mix(in srgb, …)`) or hex. `null` for anything else.
 */
export function toHex(css: string): string | null {
  const v = css.trim().toLowerCase();
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!;
    return h.length === 3 ? `#${[...h].map((c) => c + c).join('')}` : `#${h}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (rgb) return `#${byte(+rgb[1]!)}${byte(+rgb[2]!)}${byte(+rgb[3]!)}`;
  const srgb = /^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/.exec(v);
  if (srgb) return `#${byte(+srgb[1]! * 255)}${byte(+srgb[2]! * 255)}${byte(+srgb[3]! * 255)}`;
  return null;
}

/**
 * Resolves custom properties holding colours (`--k-video`, `--age-2`, …) as seen from `el` to `#rrggbb`, so the
 * canvas and `textOn` get plain colours even when a token is a `color-mix()`: a probe element takes each
 * property as its `color` and the browser computes it. Unresolvable values keep the raw property value.
 */
export function resolveColors(el: HTMLElement, names: readonly string[]): Record<string, string> {
  const probe = el.ownerDocument.createElement('span');
  probe.style.display = 'none';
  el.appendChild(probe);
  const out: Record<string, string> = {};
  try {
    for (const name of names) {
      probe.style.color = `var(${name})`;
      const computed = getComputedStyle(probe).color;
      out[name] =
        toHex(computed) ?? (getComputedStyle(el).getPropertyValue(name).trim() || computed);
    }
  } finally {
    probe.remove();
  }
  return out;
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function textOn(hex: string): '#111111' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#111111';
  const n = parseInt(m[1]!, 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white vs. black.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#111111';
}

/** Draws the pattern of `id` into `ctx` over the rectangle (ink is semi-transparent). */
export function drawPattern(
  ctx: CanvasRenderingContext2D,
  id: PatternId,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: string,
): void {
  if (id === 'none' || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1;
  const step = 7;
  ctx.beginPath();
  if (id === 'dots') {
    for (let yy = y + 3; yy < y + h; yy += step)
      for (let xx = x + 3; xx < x + w; xx += step) {
        ctx.moveTo(xx + 1.2, yy);
        ctx.arc(xx, yy, 1.2, 0, Math.PI * 2);
      }
    ctx.fill();
  } else {
    if (id === 'diagonal' || id === 'cross')
      for (let d = -h; d < w; d += step) {
        ctx.moveTo(x + d, y + h);
        ctx.lineTo(x + d + h, y);
      }
    if (id === 'backdiagonal' || id === 'cross')
      for (let d = 0; d < w + h; d += step) {
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d - h, y + h);
      }
    if (id === 'vertical' || id === 'grid')
      for (let xx = x + 2; xx < x + w; xx += step - 2) {
        ctx.moveTo(xx, y);
        ctx.lineTo(xx, y + h);
      }
    if (id === 'horizontal' || id === 'grid')
      for (let yy = y + 2; yy < y + h; yy += step - 2) {
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
      }
    ctx.stroke();
  }
  ctx.restore();
}
