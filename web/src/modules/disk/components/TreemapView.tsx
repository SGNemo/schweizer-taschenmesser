import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { DiskNode } from '@/core/platform/disk';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { AGE_VAR, ageDays, ageIndex } from '../logic/age';
import { KIND_PATTERN, KIND_VAR, drawPattern, textOn } from '../logic/colors';
import { formatBytes } from '../format';
import { groupByParent, toLayoutNodes } from '../logic/tree';
import { DEFAULT_LAYOUT, hitTest, layoutTree, type LaidOut } from '../logic/treemap';
import { useThemeKey } from './useThemeKey';
import styles from './TreemapView.module.css';

export type ColorMode = 'age' | 'type' | 'depth';

interface Props {
  /** The folder shown; its entries (and their children) are `nodes`. */
  root: DiskNode;
  nodes: readonly DiskNode[];
  colorBy: ColorMode;
  selectedId: number | null;
  /** Called with the canvas size whenever it changes (the parent fetches what fits). */
  onSize: (w: number, h: number) => void;
  onZoom: (node: DiskNode) => void;
  onSelect: (node: DiskNode) => void;
  onUp: () => void;
  tooltip: (node: DiskNode) => ReactNode;
  /** Shown over an empty map (default: "nothing uses space here"). */
  emptyText?: string;
  testId?: string;
}

interface Palette {
  kinds: Record<string, string>;
  ages: string[];
  surface: string;
  surface2: string;
  text: string;
  accent: string;
  focus: string;
  font: string;
}

const readPalette = (el: HTMLElement): Palette => {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const kinds: Record<string, string> = {};
  for (const [k, name] of Object.entries(KIND_VAR)) kinds[k] = v(name) || '#7a7f87';
  return {
    kinds,
    ages: AGE_VAR.map((name) => v(name) || '#7a7f87'),
    surface: v('--surface') || '#ffffff',
    surface2: v('--surface-2') || '#f0f0ed',
    text: v('--text') || '#1c1d1f',
    accent: v('--accent') || '#2f6f8f',
    focus: v('--focus') || '#1a5fd0',
    font: cs.fontFamily || 'sans-serif',
  };
};

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : '';
}

export function TreemapView({
  root,
  nodes,
  colorBy,
  selectedId,
  onSize,
  onZoom,
  onSelect,
  onUp,
  tooltip,
  emptyText,
  testId = 'treemap',
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = useRef<Palette | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const themeKey = useThemeKey();

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const tiles = useMemo<LaidOut[]>(() => {
    if (size.w < 10 || size.h < 10) return [];
    const groups = groupByParent(nodes);
    return layoutTree(root.id, (id) => toLayoutNodes(groups.get(id) ?? []), {
      x: 0,
      y: 0,
      w: size.w,
      h: size.h,
    });
  }, [nodes, root.id, size]);
  const topLevel = useMemo(() => tiles.filter((x) => x.depth === 0), [tiles]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.floor(r.width), h: Math.floor(r.height) };
      setSize((s) => (s.w === next.w && s.h === next.h ? s : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 0) onSize(size.w, size.h);
  }, [size, onSize]);

  useEffect(() => {
    if (wrap.current) palette.current = readPalette(wrap.current);
  }, [themeKey]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || size.w < 10) return;
    if (!palette.current && wrap.current) palette.current = readPalette(wrap.current);
    const p = palette.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = p.surface2;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.textBaseline = 'top';

    const nowMs = now();
    const header = DEFAULT_LAYOUT.header;
    const colorOf = (n: DiskNode): string =>
      colorBy === 'type'
        ? (p.kinds[n.fileKind] ?? p.kinds.other!)
        : colorBy === 'age'
          ? p.ages[ageIndex(ageDays(n.modified, nowMs))]!
          : p.accent;

    for (const tile of tiles) {
      const n = byId.get(tile.id);
      if (!n) continue;
      const { x, y, w, h } = tile.rect;
      const color = colorOf(n);

      if (tile.open) {
        // An open folder: a quiet tinted body and a stronger header band with its name and size.
        ctx.fillStyle = p.surface;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = colorBy === 'depth' ? 0.1 + 0.08 * tile.depth : 0.14;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        const band = Math.min(header, h);
        ctx.globalAlpha = colorBy === 'depth' ? 0.45 + 0.1 * tile.depth : 0.6;
        ctx.fillRect(x, y, w, band);
        ctx.globalAlpha = 1;
        if (w > 40 && band >= 14) {
          ctx.fillStyle = textOn(color);
          ctx.font = `600 11px ${p.font}`;
          const size = formatBytes(n.bytes);
          const sizeW = ctx.measureText(size).width;
          const room = w - 8 - (w > 120 ? sizeW + 8 : 0);
          const label = fit(ctx, n.name, room);
          if (label) ctx.fillText(label, x + 4, y + 2);
          if (w > 120) {
            ctx.font = `11px ${p.font}`;
            ctx.fillText(size, x + w - 4 - sizeW, y + 2);
          }
        }
        continue;
      }

      // A leaf: a small gap to its neighbours, rounded corners and a soft cushion shading.
      const gap = w > 6 && h > 6 ? 1 : 0;
      const rx = x + gap;
      const ry = y + gap;
      const rw = w - 2 * gap;
      const rh = h - 2 * gap;
      const r = Math.min(3, rw / 4, rh / 4);
      const shape = () => {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(rx, ry, rw, rh, r);
        else ctx.rect(rx, ry, rw, rh);
      };
      shape();
      ctx.fillStyle = p.surface;
      ctx.fill();
      ctx.globalAlpha =
        colorBy === 'depth'
          ? n.kind === 'dir'
            ? 0.75
            : 0.5 + 0.1 * tile.depth
          : n.kind === 'small'
            ? 0.65
            : 1;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (rw > 8 && rh > 8) {
        const shade = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
        shade.addColorStop(0, 'rgba(255,255,255,0.18)');
        shade.addColorStop(0.6, 'rgba(255,255,255,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = shade;
        ctx.fill();
      }
      if (colorBy === 'type') {
        drawPattern(ctx, KIND_PATTERN[n.fileKind], rx, ry, rw, rh, 'rgba(255,255,255,0.22)');
      }
      if (n.id === hoverId) {
        shape();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();
      }

      if (rw > 50 && rh > 18) {
        ctx.fillStyle = textOn(color);
        ctx.font = `600 12px ${p.font}`;
        const name = n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name;
        const label = fit(ctx, name, rw - 10);
        if (label) ctx.fillText(label, rx + 5, ry + 4);
        if (rh > 36) {
          ctx.font = `11px ${p.font}`;
          ctx.globalAlpha = 0.9;
          const info =
            colorBy === 'age'
              ? `${formatBytes(n.bytes)} · ${t.disk.age.short(ageDays(n.modified, nowMs))}`
              : formatBytes(n.bytes);
          const line = fit(ctx, info, rw - 10);
          if (line) ctx.fillText(line, rx + 5, ry + 20);
          ctx.globalAlpha = 1;
        }
      }
    }

    const outline = (id: number | null, color: string, width: number) => {
      if (id === null) return;
      const tile = tiles.find((x) => x.id === id);
      if (!tile) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      const { x, y, w, h } = tile.rect;
      ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
    };
    outline(hoverId, p.text, 2);
    outline(selectedId, p.focus, 3);
  }, [tiles, byId, colorBy, hoverId, selectedId, size, themeKey]);

  const pointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointer(e);
    const hit = hitTest(tiles, x, y);
    setHoverId(hit?.id ?? null);
    setTipPos({ x, y });
  };

  const onClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(tiles, e.clientX - r.left, e.clientY - r.top);
    const n = hit ? byId.get(hit.id) : undefined;
    if (!n) return;
    const modifier = e.shiftKey || e.ctrlKey || e.metaKey;
    if (n.kind === 'dir' && !modifier) onZoom(n);
    else onSelect(n);
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const order = topLevel.map((x) => byId.get(x.id)!).filter(Boolean);
    const idx = order.findIndex((n) => n.id === selectedId);
    const move = (d: number) => {
      if (!order.length) return;
      const next =
        order[(idx < 0 ? (d > 0 ? 0 : order.length - 1) : idx + d + order.length) % order.length]!;
      onSelect(next);
    };
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        move(-1);
        break;
      case 'Enter': {
        const n = idx >= 0 ? order[idx] : undefined;
        if (n?.kind === 'dir') onZoom(n);
        break;
      }
      case 'Backspace':
      case 'Escape':
        onUp();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const hovered = hoverId !== null ? byId.get(hoverId) : undefined;

  return (
    <div className={styles.wrap} ref={wrap} data-testid={testId}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        tabIndex={0}
        role="img"
        aria-label={t.disk.map.label(root.name, topLevel.length)}
        aria-describedby="disk-map-help"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverId(null)}
        onClick={onClick}
        onKeyDown={onKey}
      />
      {nodes.length === 0 ? (
        <div className={styles.empty}>{emptyText ?? t.disk.map.empty}</div>
      ) : null}
      {hovered ? (
        <div
          className={styles.tip}
          role="presentation"
          style={{
            left: Math.min(tipPos.x + 14, Math.max(0, size.w - 250)),
            top: Math.min(tipPos.y + 14, Math.max(0, size.h - 130)),
          }}
        >
          {tooltip(hovered)}
        </div>
      ) : null}
    </div>
  );
}
