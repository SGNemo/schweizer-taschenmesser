/**
 * Lower zooms are built from the stored tiles one level deeper (never from the network again): the
 * four children of a tile are scaled into it, features that appear in several children are joined,
 * what the style table does not draw at that zoom is dropped, the rest is simplified. Pure.
 */
import { simplify } from './cut';
import { EXTENT, ringArea, type TileFeature, type TileLayer, type VectorTile } from './mvt';
import { styleOf } from './styleTable';

export interface ChildTile {
  z: number;
  x: number;
  y: number;
  tile: VectorTile;
}

/** Parts shorter than this (tile units) or rings smaller than this area are not worth a byte at the parent. */
const MIN_LINE = 2;
const MIN_AREA = 12;

/** The tile `z/x/y` built from its children at `z + 1` (undefined when they hold nothing for this zoom). */
export function buildParent(
  z: number,
  x: number,
  y: number,
  children: readonly ChildTile[],
  tolerance = 1,
): VectorTile | undefined {
  const layers = new Map<string, Map<string, TileFeature>>();
  const anon = new Map<string, TileFeature[]>();
  for (const child of children) {
    const dz = child.z - z;
    if (dz < 1) continue;
    const parts = 2 ** dz;
    for (const layer of child.tile.layers) {
      const extent = layer.extent ?? EXTENT;
      const ox = (child.x - x * parts) * extent;
      const oy = (child.y - y * parts) * extent;
      for (const f of layer.features) {
        const cls = typeof f.tags.class === 'string' ? f.tags.class : undefined;
        const style = styleOf(layer.name, cls);
        if (!style || z < style.minZoom) continue;
        const geometry = f.geometry.map((part) =>
          part.map(([px, py]) => [Math.round((ox + px!) / parts), Math.round((oy + py!) / parts)]),
        );
        const moved: TileFeature = { ...f, geometry };
        if (f.id !== undefined) {
          const byId = layers.get(layer.name) ?? new Map<string, TileFeature>();
          const key = String(f.id);
          const existing = byId.get(key);
          if (existing && f.type !== 'point') existing.geometry.push(...geometry);
          else if (!existing) byId.set(key, moved);
          layers.set(layer.name, byId);
        } else {
          const list = anon.get(layer.name) ?? [];
          list.push(moved);
          anon.set(layer.name, list);
        }
      }
    }
  }
  const names = new Set([...layers.keys(), ...anon.keys()]);
  const out: TileLayer[] = [];
  for (const name of names) {
    const features = [...(layers.get(name)?.values() ?? []), ...(anon.get(name) ?? [])]
      .map((f) => tidy(f, tolerance))
      .filter((f): f is TileFeature => f !== undefined);
    if (features.length > 0) out.push({ name, extent: EXTENT, features });
  }
  return out.length > 0 ? { layers: out } : undefined;
}

function tidy(f: TileFeature, tolerance: number): TileFeature | undefined {
  if (f.type === 'point') return f.geometry.flat().length > 0 ? f : undefined;
  const geometry = f.geometry
    .map((part) => simplify(part as [number, number][], tolerance))
    .filter((part) =>
      f.type === 'line'
        ? part.length >= 2 && length(part) >= MIN_LINE
        : part.length >= 3 && Math.abs(ringArea(part)) >= MIN_AREA,
    );
  if (geometry.length === 0) return undefined;
  if (f.type === 'polygon' && ringArea(geometry[0]!) < 0) return undefined; // the exterior ring was dropped
  return { ...f, geometry };
}

function length(part: number[][]): number {
  let sum = 0;
  for (let i = 1; i < part.length; i++)
    sum += Math.hypot(part[i]![0]! - part[i - 1]![0]!, part[i]![1]! - part[i - 1]![1]!);
  return sum;
}
