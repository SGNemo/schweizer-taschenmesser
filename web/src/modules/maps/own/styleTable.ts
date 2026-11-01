/**
 * The style table of the own map: layer + class → how and from which zoom it is drawn. Pure data and
 * helpers without any DOM or CSS import, so the build worker can use the zoom thresholds as well.
 */
import type { PaletteKey } from './style';

export interface FillStyle {
  kind: 'fill';
  color: PaletteKey;
  /** Outline, drawn from this zoom on. */
  line?: { color: PaletteKey; width: number; minZoom: number };
  minZoom: number;
}

export interface LineStyle {
  kind: 'line';
  color: PaletteKey;
  /** Width in CSS px at zoom 16; halves per zoom level below, grows above (capped). */
  width: number;
  casing?: { color: PaletteKey; extra: number };
  dash?: number[];
  minZoom: number;
  /** Draw the `name` tag along the line from this zoom on. */
  labelZoom?: number;
}

export interface PointStyle {
  kind: 'point';
  color: PaletteKey;
  /** Font size in CSS px. */
  size: number;
  bold?: boolean;
  minZoom: number;
  /** Dot before the name (POIs). */
  dot?: boolean;
}

export type Style = FillStyle | LineStyle | PointStyle;

const fill = (color: PaletteKey, minZoom: number, line?: FillStyle['line']): FillStyle => ({
  kind: 'fill',
  color,
  minZoom,
  ...(line ? { line } : {}),
});
const line = (
  color: PaletteKey,
  width: number,
  minZoom: number,
  extra: Partial<LineStyle> = {},
): LineStyle => ({ kind: 'line', color, width, minZoom, ...extra });
const road = (width: number, minZoom: number, major: boolean, labelZoom = 16): LineStyle =>
  line(major ? 'roadMajor' : 'roadMinor', width, minZoom, {
    casing: { color: major ? 'roadMajorCasing' : 'roadMinorCasing', extra: 2 },
    labelZoom,
  });
const point = (
  color: PaletteKey,
  size: number,
  minZoom: number,
  extra: Partial<PointStyle> = {},
): PointStyle => ({ kind: 'point', color, size, minZoom, ...extra });

/** Draw order = order of this list. Keyed `layer/class`; `layer/*` is the default of a layer. */
export const STYLES: [string, Style][] = [
  ['landuse/residential', fill('residential', 11)],
  ['landuse/industrial', fill('industrial', 11)],
  ['landuse/commercial', fill('industrial', 11)],
  ['landuse/forest', fill('forest', 8)],
  ['landuse/wood', fill('forest', 8)],
  ['landuse/park', fill('park', 11)],
  ['landuse/grass', fill('park', 13)],
  ['landuse/cemetery', fill('park', 13)],
  ['landuse/*', fill('residential', 12)],
  ['water/*', fill('water', 6)],
  ['waterway/river', line('water', 4, 9)],
  ['waterway/canal', line('water', 3, 11)],
  ['waterway/*', line('water', 1.5, 13)],
  ['building/*', fill('building', 14, { color: 'buildingLine', width: 0.75, minZoom: 16 })],
  ['rail/*', line('rail', 1.5, 10, { dash: [6, 4] })],
  ['road/path', line('path', 1, 14, { dash: [3, 3], labelZoom: 17 })],
  ['road/cycleway', line('path', 1, 14, { dash: [3, 3], labelZoom: 17 })],
  ['road/steps', line('path', 1.5, 15, { dash: [2, 2] })],
  ['road/track', line('path', 1, 14, { dash: [5, 3] })],
  ['road/service', road(2, 14, false, 17)],
  ['road/living', road(3, 13, false)],
  ['road/pedestrian', road(3, 13, false)],
  ['road/residential', road(4, 12, false)],
  ['road/tertiary', road(5, 11, true)],
  ['road/secondary', road(6, 10, true)],
  ['road/primary', road(7, 9, true)],
  ['road/trunk', road(8, 8, true)],
  [
    'road/motorway',
    line('motorway', 9, 7, { casing: { color: 'motorwayCasing', extra: 2 }, labelZoom: 15 }),
  ],
  ['road/*', road(3, 13, false)],
  ['boundary/*', line('boundary', 1, 6, { dash: [8, 4] })],
  ['place/city', point('text', 15, 6, { bold: true })],
  ['place/town', point('text', 13, 8, { bold: true })],
  ['place/village', point('text', 12, 10)],
  ['place/suburb', point('text', 12, 12)],
  ['place/neighbourhood', point('text', 11, 14)],
  ['place/*', point('text', 11, 13)],
  ['poi/*', point('poi', 10, 16, { dot: true })],
];

const byKey = new Map(STYLES);

/** The style key of a feature of `layer` with `cls` (`layer/class` or `layer/*`), or undefined when it is not drawn. */
export function styleKeyOf(layer: string, cls: string | undefined): string | undefined {
  if (cls && byKey.has(`${layer}/${cls}`)) return `${layer}/${cls}`;
  return byKey.has(`${layer}/*`) ? `${layer}/*` : undefined;
}

/** The style of a feature of `layer` with `cls`, or undefined when it is not drawn at all. */
export function styleOf(layer: string, cls: string | undefined): Style | undefined {
  const key = styleKeyOf(layer, cls);
  return key ? byKey.get(key) : undefined;
}

/** Line width at a zoom (declared for zoom 16). */
export function widthAt(width: number, zoom: number): number {
  const w = width * 2 ** Math.min(zoom - 16, 2);
  return Math.max(0.6, w);
}
