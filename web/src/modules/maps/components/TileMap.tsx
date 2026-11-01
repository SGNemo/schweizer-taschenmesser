import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Icon, IconButton } from '@/ui';
import {
  clampZoom,
  fromScreen,
  panBy,
  tileUrl,
  toScreen,
  visibleTiles,
  zoomAt,
  type View,
} from '../logic';
import { loadTile, type TileResult } from '../tiles';
import styles from './TileMap.module.css';

/**
 * Gives the image of tile `z/x/y` (`url` = the online address from the template). The page decides
 * where it comes from: the own map first, the online tiles after, or nothing (`{}`) in offline-only mode.
 */
export type TileResolver = (z: number, x: number, y: number, url: string) => Promise<TileResult>;
const onlineOnly: TileResolver = (_z, _x, _y, url) => loadTile(url);

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label: string;
  kind: 'place' | 'selected';
}

export interface TileMapLabels {
  map: string;
  zoomIn: string;
  zoomOut: string;
  locate?: string;
  blocked: string;
  failed: string;
}

/** Pointer travel (px) below which a press counts as a click, not a drag. */
const CLICK_PX = 5;

function Tile({
  url,
  z,
  x,
  y,
  left,
  top,
  size,
  resolve,
  resolveKey,
  onError,
}: {
  url: string;
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
  resolve: TileResolver;
  /** Changes when the source changed (theme, own map, setting): the tile asks again. */
  resolveKey: string;
  onError: (why: 'blocked' | 'failed', status?: number) => void;
}) {
  const [src, setSrc] = useState<string>();
  // The callbacks change identity on every render of the map; the tile only re-asks for a new address or key.
  const latest = useRef({ resolve, onError });
  useEffect(() => {
    latest.current = { resolve, onError };
  });
  useEffect(() => {
    let alive = true;
    void resolveKey;
    void latest.current.resolve(z, x, y, url).then((r) => {
      if (!alive) return;
      if (r.src) setSrc(r.src);
      else if (r.error) latest.current.onError(r.error, r.status);
    });
    return () => {
      alive = false;
    };
  }, [url, z, x, y, resolveKey]);
  return src ? (
    <img
      className={styles.tile}
      src={src}
      alt=""
      draggable={false}
      style={{ left, top, width: size + 0.5, height: size + 0.5 }}
    />
  ) : null;
}

/**
 * A slippy map without a map library: Web Mercator tiles as `<img>`, drag / pinch / wheel / keys to move,
 * markers on top. The tiles come from `loadTile` (platform fetch → `blob:`), so nothing here talks to the
 * network by itself. Pure maths in `../logic`.
 */
export function TileMap({
  view,
  onView,
  template,
  markers,
  selected,
  line,
  onPick,
  onMarker,
  onLocate,
  labels,
  attribution,
  resolve = onlineOnly,
  resolveKey = '',
}: {
  view: View;
  onView: (view: View) => void;
  template: string;
  /** Where tiles come from; default: the online template only. */
  resolve?: TileResolver;
  resolveKey?: string;
  markers: readonly MapMarker[];
  selected?: { lat: number; lon: number };
  /** A route line to draw (already thinned). */
  line?: readonly { lat: number; lon: number }[];
  onPick?: (lat: number, lon: number) => void;
  onMarker?: (id: string) => void;
  onLocate?: () => void;
  labels: TileMapLabels;
  attribution: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [problem, setProblem] = useState<{ why: 'blocked' | 'failed'; status?: number }>();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, startX: 0, startY: 0, pinch: 0 });
  const latest = useRef({ view, onView });
  useEffect(() => {
    latest.current = { view, onView };
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The wheel zooms the map, not the page: needs a non-passive listener.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const { view: v, onView: set } = latest.current;
      set(
        zoomAt(
          v,
          v.zoom + (e.deltaY < 0 ? 0.5 : -0.5),
          e.clientX - r.left,
          e.clientY - r.top,
          r.width,
          r.height,
        ),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const tiles = visibleTiles(view, size.w, size.h);
  const onTileError = (why: 'blocked' | 'failed', status?: number) =>
    setProblem((p) => (p?.why === 'blocked' ? p : { why, status }));

  function down(e: PointerEvent) {
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { moved: 0, startX: e.clientX, startY: e.clientY, pinch: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      gesture.current.moved = CLICK_PX + 1;
    }
  }
  function move(e: PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 1) {
      gesture.current.moved = Math.max(
        gesture.current.moved,
        Math.hypot(next.x - gesture.current.startX, next.y - gesture.current.startY),
      );
      if (gesture.current.moved > CLICK_PX) onView(panBy(view, next.x - prev.x, next.y - prev.y));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (gesture.current.pinch > 0 && dist > 0) {
        const r = box.current!.getBoundingClientRect();
        const zoom = view.zoom + Math.log2(dist / gesture.current.pinch);
        onView(
          zoomAt(
            view,
            zoom,
            (a!.x + b!.x) / 2 - r.left,
            (a!.y + b!.y) / 2 - r.top,
            r.width,
            r.height,
          ),
        );
      }
      gesture.current.pinch = dist;
    }
  }
  function up(e: PointerEvent) {
    const wasOne = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (wasOne && gesture.current.moved <= CLICK_PX && onPick) {
      const r = box.current!.getBoundingClientRect();
      const p = fromScreen(view, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      onPick(p.lat, p.lon);
    }
    if (pointers.current.size === 1) {
      // One finger lifted: carry on dragging with the other, without a jump.
      gesture.current.pinch = 0;
      gesture.current.moved = CLICK_PX + 1;
    }
  }
  function key(e: KeyboardEvent) {
    const step = 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      onView(panBy(view, m[0], m[1]));
    } else if (e.key === '+' || e.key === '=') {
      onView({ ...view, zoom: clampZoom(Math.round(view.zoom) + 1) });
    } else if (e.key === '-') {
      onView({ ...view, zoom: clampZoom(Math.round(view.zoom) - 1) });
    }
  }
  const zoomBy = (d: number) => onView({ ...view, zoom: clampZoom(Math.round(view.zoom) + d) });

  const pins = [
    ...markers,
    ...(selected
      ? [
          {
            id: '__selected',
            lat: selected.lat,
            lon: selected.lon,
            label: '',
            kind: 'selected' as const,
          },
        ]
      : []),
  ];
  return (
    <div className={styles.wrap}>
      <div
        ref={box}
        className={styles.map}
        role="application"
        aria-label={labels.map}
        tabIndex={0}
        data-testid="tile-map"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={(e) => {
          const r = box.current!.getBoundingClientRect();
          onView(
            zoomAt(
              view,
              Math.round(view.zoom) + 1,
              e.clientX - r.left,
              e.clientY - r.top,
              r.width,
              r.height,
            ),
          );
        }}
        onKeyDown={key}
      >
        {tiles.map((t) => (
          <Tile
            key={`${t.z}/${t.x}/${t.y}`}
            url={tileUrl(template, t.z, t.x, t.y)}
            z={t.z}
            x={t.x}
            y={t.y}
            left={t.left}
            top={t.top}
            size={t.size}
            resolve={resolve}
            resolveKey={resolveKey}
            onError={onTileError}
          />
        ))}
        {line && line.length > 1 ? (
          <svg
            className={styles.line}
            width={size.w}
            height={size.h}
            aria-hidden="true"
            data-testid="map-line"
          >
            <polyline
              fill="none"
              points={line
                .map((pt) => {
                  const p = toScreen(view, pt.lat, pt.lon, size.w, size.h);
                  return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
                })
                .join(' ')}
            />
          </svg>
        ) : null}
        {pins.map((m) => {
          const p = toScreen(view, m.lat, m.lon, size.w, size.h);
          if (p.x < -24 || p.y < -48 || p.x > size.w + 24 || p.y > size.h + 24) return null;
          return m.kind === 'selected' ? (
            <span
              key={m.id}
              className={`${styles.pin} ${styles.selected}`}
              style={{ left: p.x, top: p.y }}
            >
              <Icon name="mapPin" size={32} />
            </span>
          ) : (
            <button
              key={m.id}
              type="button"
              className={styles.pin}
              style={{ left: p.x, top: p.y }}
              aria-label={m.label}
              title={m.label}
              data-testid="map-marker"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onMarker?.(m.id)}
            >
              <Icon name="mapPin" size={28} />
            </button>
          );
        })}
        {problem ? (
          <p className={styles.problem} role="status">
            {problem.why === 'blocked'
              ? labels.blocked
              : problem.status
                ? `${labels.failed} (HTTP ${problem.status})`
                : labels.failed}
          </p>
        ) : null}
      </div>
      <div className={styles.controls}>
        <IconButton label={labels.zoomIn} onClick={() => zoomBy(1)}>
          <Icon name="plus" />
        </IconButton>
        <IconButton label={labels.zoomOut} onClick={() => zoomBy(-1)}>
          <Icon name="minus" />
        </IconButton>
        {onLocate && labels.locate ? (
          <IconButton label={labels.locate} onClick={onLocate}>
            <Icon name="locate" />
          </IconButton>
        ) : null}
      </div>
      <p className={styles.attribution}>{attribution}</p>
    </div>
  );
}
