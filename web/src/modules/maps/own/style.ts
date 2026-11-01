/**
 * What the own map looks like: a small style table (layer + class → how to draw at which zoom) and the
 * palette, read from the design tokens at render time so light and dark mode need no second table.
 */
import css from './palette.module.css';

export const PALETTE_KEYS = [
  'land',
  'water',
  'park',
  'forest',
  'residential',
  'industrial',
  'building',
  'buildingLine',
  'roadMajor',
  'roadMajorCasing',
  'roadMinor',
  'roadMinorCasing',
  'motorway',
  'motorwayCasing',
  'path',
  'rail',
  'boundary',
  'text',
  'textHalo',
  'poi',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export interface Palette {
  colors: Record<PaletteKey, string>;
  fontFamily: string;
}

/** A neutral palette for tests and for documents without styles (greys only). */
export function fallbackPalette(): Palette {
  const colors = Object.fromEntries(PALETTE_KEYS.map((k) => [k, 'rgb(128, 128, 128)'])) as Record<
    PaletteKey,
    string
  >;
  colors.land = 'rgb(240, 240, 240)';
  colors.textHalo = 'rgb(255, 255, 255)';
  colors.text = 'rgb(20, 20, 20)';
  return { colors, fontFamily: 'sans-serif' };
}

/**
 * Reads the palette from the live tokens: a hidden probe with one span per colour, resolved by the
 * browser (`color-mix` included), removed again at once. Falls back to greys where there is no DOM.
 */
export function readPalette(doc: Document | undefined = globalThis.document): Palette {
  if (!doc?.body || typeof getComputedStyle !== 'function') return fallbackPalette();
  const probe = doc.createElement('div');
  probe.className = css.probe ?? 'probe';
  probe.setAttribute('aria-hidden', 'true');
  const spans = new Map<PaletteKey, HTMLElement>();
  for (const key of PALETTE_KEYS) {
    const span = doc.createElement('span');
    span.className = css[key] ?? key;
    probe.appendChild(span);
    spans.set(key, span);
  }
  doc.body.appendChild(probe);
  try {
    const base = fallbackPalette();
    for (const [key, span] of spans) {
      const color = getComputedStyle(span).color;
      if (color) base.colors[key] = color;
    }
    const font = getComputedStyle(doc.documentElement).getPropertyValue('--font-sans').trim();
    if (font) base.fontFamily = font;
    return base;
  } finally {
    probe.remove();
  }
}

export {
  STYLES,
  styleKeyOf,
  styleOf,
  widthAt,
  type FillStyle,
  type LineStyle,
  type PointStyle,
  type Style,
} from './styleTable';
