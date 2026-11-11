/**
 * The touchpad's gestures as a pure function: touches in, what to send out (concept
 * `docs/design/remote-control/CONCEPT.md` §2). No timer, no clock of its own (time comes with the
 * touch), nothing stored: a coordinate lives only in the state of the gesture it belongs to.
 *
 * | Gesture | Out |
 * |---|---|
 * | one finger slides | `move` |
 * | tap | `click left` |
 * | two-finger tap | `click right` |
 * | two fingers slide | `scroll` |
 *
 * A double click is two taps (the PC decides by its own double-click time). Dragging is not a
 * gesture: the strip "Links" holds the button while a finger slides here. Three fingers and more
 * do nothing.
 */
export type Touch =
  | { type: 'down' | 'move'; id: number; x: number; y: number; t: number }
  | { type: 'up'; id: number; t: number }
  /** The system took the touch away (a system gesture, a call): never a click. */
  | { type: 'cancel'; id: number };

export type PadOut =
  /** Relative, in the PC's own pointer units. `dy > 0` is down. */
  | { kind: 'move'; dx: number; dy: number }
  /** In wheel units (8 = one notch). `dy > 0` moves the view down, `dx > 0` to the right. */
  | { kind: 'scroll'; dx: number; dy: number }
  | { kind: 'click'; button: 'left' | 'right' };

/** A touch that ends within this time and stayed in place is a tap. */
export const TAP_MS = 250;
/** A finger that moved less than this (CSS px) has not moved: a tap stays a tap, the pointer still. */
export const SLOP_PX = 8;
/** Finger travel (CSS px) for one wheel unit: about 48 px a notch. */
export const SCROLL_PX = 6;

interface Finger {
  id: number;
  x: number;
  y: number;
}

export interface PadState {
  fingers: readonly Finger[];
  /** When the first finger of this gesture went down. */
  since: number;
  /** The most fingers down at once in this gesture. */
  most: number;
  /** A finger left its place: no tap any more. */
  moved: boolean;
  /** Travel since the gesture began, until it counts as moved. */
  travelX: number;
  travelY: number;
  /** The part of a step that was too small to send yet. */
  restX: number;
  restY: number;
}

export const PAD_IDLE: PadState = {
  fingers: [],
  since: 0,
  most: 0,
  moved: false,
  travelX: 0,
  travelY: 0,
  restX: 0,
  restY: 0,
};

/** Whole steps of `value`, toward zero, and what is left over. */
function whole(value: number): [number, number] {
  const n = Math.trunc(value);
  return [n, value - n];
}

/**
 * One touch. `speed` scales the pointer (the phone's sensitivity setting; the PC adds its own
 * pointer speed and acceleration).
 */
export function padStep(state: PadState, touch: Touch, speed: number): [PadState, PadOut[]] {
  if (touch.type === 'down') {
    if (state.fingers.some((f) => f.id === touch.id)) return [state, []];
    const finger = { id: touch.id, x: touch.x, y: touch.y };
    if (state.fingers.length === 0)
      return [{ ...PAD_IDLE, fingers: [finger], since: touch.t, most: 1 }, []];
    const fingers = [...state.fingers, finger];
    // another finger starts another kind of sliding: left-overs of the old one do not carry over
    return [
      { ...state, fingers, most: Math.max(state.most, fingers.length), restX: 0, restY: 0 },
      [],
    ];
  }

  const at = state.fingers.findIndex((f) => f.id === touch.id);
  if (at < 0) return [state, []];

  if (touch.type === 'cancel') return [PAD_IDLE, []];

  if (touch.type === 'up') {
    const fingers = state.fingers.filter((f) => f.id !== touch.id);
    if (fingers.length > 0) return [{ ...state, fingers }, []];
    // the last finger left: was it a tap?
    const tap = !state.moved && touch.t - state.since <= TAP_MS;
    if (tap && state.most === 1) return [PAD_IDLE, [{ kind: 'click', button: 'left' }]];
    if (tap && state.most === 2) return [PAD_IDLE, [{ kind: 'click', button: 'right' }]];
    return [PAD_IDLE, []];
  }

  const before = state.fingers[at]!;
  const dx = touch.x - before.x;
  const dy = touch.y - before.y;
  const fingers = state.fingers.map((f, i) => (i === at ? { ...f, x: touch.x, y: touch.y } : f));
  let next: PadState = { ...state, fingers };
  if (!next.moved) {
    // until the finger has really left its place nothing moves: a tap must not nudge the pointer
    const travelX = next.travelX + dx;
    const travelY = next.travelY + dy;
    if (Math.hypot(travelX, travelY) < SLOP_PX) return [{ ...next, travelX, travelY }, []];
    next = { ...next, moved: true };
  }
  // one finger – and only if there never was a second one in this gesture: lifting one of two
  // must not make the pointer jump
  if (fingers.length === 1 && next.most === 1) {
    const [mx, restX] = whole(next.restX + dx * speed);
    const [my, restY] = whole(next.restY + dy * speed);
    next = { ...next, restX, restY };
    return [next, mx === 0 && my === 0 ? [] : [{ kind: 'move', dx: mx, dy: my }]];
  }
  if (fingers.length === 2 && next.most === 2) {
    // each finger carries half; like on a phone the content follows the fingers, so the view
    // goes the other way
    const [sx, restX] = whole(next.restX - dx / 2 / SCROLL_PX);
    const [sy, restY] = whole(next.restY - dy / 2 / SCROLL_PX);
    next = { ...next, restX, restY };
    return [next, sx === 0 && sy === 0 ? [] : [{ kind: 'scroll', dx: sx, dy: sy }]];
  }
  return [next, []];
}
