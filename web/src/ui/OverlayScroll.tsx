import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './OverlayScroll.module.css';

interface State {
  top: boolean;
  bottom: boolean;
  scrollable: boolean;
  thumbHeight: number;
  thumbTop: number;
}
const IDLE: State = { top: false, bottom: false, scrollable: false, thumbHeight: 0, thumbTop: 0 };
const MIN_THUMB = 24;

/**
 * A vertical scroll area with an overlay scrollbar (identity v3, docs/design/identity-v3/02-CONCEPT.md § 6): the native bar is
 * off, a 6 px thumb floats over the right edge without taking any width, shows while the pointer is over the area or while it
 * scrolls, and the edges fade out where there is more to scroll to. Wheel, touch, keyboard and links work natively; the
 * thumb can be dragged. Used where a permanent bar would eat the labels (the sidebar's navigation).
 */
export function OverlayScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>(IDLE);

  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight > clientHeight + 1;
    const thumbHeight = scrollable
      ? Math.max(MIN_THUMB, (clientHeight * clientHeight) / scrollHeight)
      : 0;
    const room = scrollHeight - clientHeight;
    const thumbTop = scrollable && room > 0 ? (scrollTop / room) * (clientHeight - thumbHeight) : 0;
    const next: State = {
      scrollable,
      top: scrollable && scrollTop > 1,
      bottom: scrollable && scrollTop + clientHeight < scrollHeight - 1,
      thumbHeight,
      thumbTop,
    };
    setState((s) => (JSON.stringify(s) === JSON.stringify(next) ? s : next));
  }, []);

  useEffect(() => {
    measure();
    const el = viewport.current;
    if (!el) return;
    // Folding a group or switching the language changes the content's height; a window resize the area's.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    ro?.observe(el);
    if (inner.current) ro?.observe(inner.current);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const drag = useRef<{ y: number; top: number } | null>(null);
  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, top: el.scrollTop };
  };
  const onThumbMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    const d = drag.current;
    if (!el || !d) return;
    const track = el.clientHeight - state.thumbHeight;
    if (track <= 0) return;
    el.scrollTop = d.top + ((e.clientY - d.y) / track) * (el.scrollHeight - el.clientHeight);
  };
  const onThumbUp = () => {
    drag.current = null;
  };

  return (
    <div
      className={`${styles.wrap} ${className ?? ''}`}
      data-top={state.top ? 'true' : undefined}
      data-bottom={state.bottom ? 'true' : undefined}
      data-scrollable={state.scrollable ? 'true' : undefined}
      data-testid="overlay-scroll"
    >
      <div ref={viewport} className={styles.viewport} onScroll={measure}>
        <div ref={inner}>{children}</div>
      </div>
      {state.scrollable ? (
        <div
          className={styles.thumb}
          style={{ height: state.thumbHeight, transform: `translateY(${state.thumbTop}px)` }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          onPointerCancel={onThumbUp}
          aria-hidden="true"
          data-testid="overlay-thumb"
        />
      ) : null}
    </div>
  );
}
