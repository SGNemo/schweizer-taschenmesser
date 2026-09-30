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
import { t } from '@/strings';
import { KIND_PATTERN, KIND_VAR, drawPattern, textOn } from '../logic/colors';
import { formatBytes } from '../format';
import { groupByParent, toLayoutNodes } from '../logic/tree';
import { hitTest, layoutTree, type LaidOut } from '../logic/treemap';
import { useThemeKey } from './useThemeKey';
import styles from './TreemapView.module.css';

export type ColorMode = 'type' | 'depth';

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
}

interface Palette {
  kinds: Record<string, string>;
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
    ctx.font = `12px ${p.font}`;
    ctx.textBaseline = 'top';

    for (const tile of tiles) {
      const n = byId.get(tile.id);
      if (!n) continue;
      const { x, y, w, h } = tile.rect;
      const kindColor = p.kinds[n.fileKind] ?? p.kinds.other!;
      let fill: string;
      let alpha: number;
      if (colorBy === 'type') {
        fill = kindColor;
        alpha = tile.open ? 0.3 : n.kind === 'small' ? 0.6 : 1;
      } else {
        fill = p.accent;
        alpha = tile.open
          ? 0.18 + 0.12 * tile.depth
          : n.kind === 'dir'
            ? 0.75
            : 0.5 + 0.1 * tile.depth;
      }
      ctx.fillStyle = p.surface;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      if (colorBy === 'type' && !tile.open) {
        drawPattern(ctx, KIND_PATTERN[n.fileKind], x, y, w, h, 'rgba(255,255,255,0.28)');
      }
      ctx.strokeStyle = tile.open ? fill : p.surface;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      if (w > 56 && h > 18) {
        const solid = !tile.open;
        const ink = solid ? textOn(colorBy === 'type' ? kindColor : p.accent) : p.text;
        ctx.fillStyle = ink;
        const name = n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name;
        const label = fit(ctx, name, w - 8);
        if (label) ctx.fillText(label, x + 4, y + 3);
        if (solid && h > 34) {
          ctx.globalAlpha = 0.85;
          const size = fit(ctx, formatBytes(n.bytes), w - 8);
          if (size) ctx.fillText(size, x + 4, y + 18);
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
    <div className={styles.wrap} ref={wrap} data-testid="treemap">
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
      {nodes.length === 0 ? <div className={styles.empty}>{t.disk.map.empty}</div> : null}
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
