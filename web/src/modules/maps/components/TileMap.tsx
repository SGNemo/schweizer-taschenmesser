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
import { loadTile } from '../tiles';
import styles from './TileMap.module.css';

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
  left,
  top,
  size,
  onError,
}: {
  url: string;
  left: number;
  top: number;
  size: number;
  onError: (why: 'blocked' | 'failed') => void;
}) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    void loadTile(url).then((r) => {
      if (!alive) return;
      if (r.src) setSrc(r.src);
      else onError(r.error ?? 'failed');
    });
    return () => {
      alive = false;
    };
  }, [url, onError]);
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
  onPick,
  onMarker,
  onLocate,
  labels,
  attribution,
}: {
  view: View;
  onView: (view: View) => void;
  template: string;
  markers: readonly MapMarker[];
  selected?: { lat: number; lon: number };
  onPick?: (lat: number, lon: number) => void;
  onMarker?: (id: string) => void;
  onLocate?: () => void;
  labels: TileMapLabels;
  attribution: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [problem, setProblem] = useState<'blocked' | 'failed'>();
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
  const onTileError = (why: 'blocked' | 'failed') => setProblem((p) => (p === 'blocked' ? p : why));

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
            left={t.left}
            top={t.top}
            size={t.size}
            onError={onTileError}
          />
        ))}
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
            {problem === 'blocked' ? labels.blocked : labels.failed}
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
