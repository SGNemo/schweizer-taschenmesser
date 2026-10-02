import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/** Distance in px at which a swipe counts (also the width of the revealed action). */
export const SWIPE_PX = 72;

export interface SwipeHandlers {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
}

/**
 * Swipe a row sideways on touch screens: right = done/paid, left = move/snooze. Mouse input is
 * ignored; a mostly vertical drag is left to the browser so lists still scroll. Without
 * animations (reduced motion) the row just snaps; the swipe itself keeps working.
 */
export function useSwipeRow({ onSwipeRight, onSwipeLeft }: SwipeHandlers) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const enabled = !!(onSwipeRight || onSwipeLeft);

  const reset = () => {
    start.current = null;
    horizontal.current = false;
    setDx(0);
  };

  const bind = enabled
    ? {
        onPointerDown(e: PointerEvent) {
          if (e.pointerType === 'mouse') return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        },
        onPointerMove(e: PointerEvent) {
          const s = start.current;
          if (!s || e.pointerId !== s.id) return;
          const moveX = e.clientX - s.x;
          const moveY = e.clientY - s.y;
          if (!horizontal.current) {
            if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) return reset();
            if (Math.abs(moveX) < 10) return;
            horizontal.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const allowed = moveX > 0 ? !!onSwipeRight : !!onSwipeLeft;
          setDx(allowed ? Math.max(-SWIPE_PX * 1.5, Math.min(SWIPE_PX * 1.5, moveX)) : 0);
        },
        onPointerUp() {
          const moved = dx;
          reset();
          if (moved >= SWIPE_PX) {
            navigator.vibrate?.(10);
            onSwipeRight?.();
          } else if (moved <= -SWIPE_PX) {
            navigator.vibrate?.(10);
            onSwipeLeft?.();
          }
        },
        onPointerCancel: reset,
      }
    : {};

  const style: CSSProperties | undefined =
    enabled && dx !== 0 ? { transform: `translateX(${dx}px)` } : undefined;
  return { bind, style, dx, enabled };
}
