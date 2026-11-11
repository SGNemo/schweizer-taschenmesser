import { describe, expect, it } from 'vitest';
import {
  PAD_IDLE,
  SCROLL_PX,
  SLOP_PX,
  TAP_MS,
  padStep,
  type PadOut,
  type Touch,
} from '../gestures';

/** Feeds the touches in order and collects what goes out. */
function run(touches: Touch[], speed = 1): PadOut[] {
  let state = PAD_IDLE;
  const out: PadOut[] = [];
  for (const touch of touches) {
    const [next, sent] = padStep(state, touch, speed);
    state = next;
    out.push(...sent);
  }
  return out;
}
const down = (id: number, x: number, y: number, t = 0): Touch => ({ type: 'down', id, x, y, t });
const move = (id: number, x: number, y: number, t = 0): Touch => ({ type: 'move', id, x, y, t });
const up = (id: number, t = 0): Touch => ({ type: 'up', id, t });

describe('touchpad gestures', () => {
  it('a tap is a left click, two taps are two', () => {
    const tap = (t: number) => [down(1, 50, 50, t), up(1, t + 80)];
    expect(run(tap(0))).toEqual([{ kind: 'click', button: 'left' }]);
    expect(run([...tap(0), ...tap(150)])).toEqual([
      { kind: 'click', button: 'left' },
      { kind: 'click', button: 'left' },
    ]);
  });

  it('a tap may tremble a little without nudging the pointer', () => {
    expect(run([down(1, 50, 50), move(1, 53, 52), up(1, 90)])).toEqual([
      { kind: 'click', button: 'left' },
    ]);
  });

  it('a touch that stays too long or leaves its place is no click', () => {
    expect(run([down(1, 50, 50), up(1, TAP_MS + 1)])).toEqual([]);
    const out = run([down(1, 50, 50), move(1, 50 + SLOP_PX + 4, 50), up(1, 60)]);
    expect(out.some((o) => o.kind === 'click')).toBe(false);
  });

  it('one finger sliding moves the pointer by what the finger travelled past the start', () => {
    const out = run([down(1, 0, 0), move(1, 10, 0), move(1, 15, 5), move(1, 15, 25)]);
    expect(out).toEqual([
      { kind: 'move', dx: 10, dy: 0 },
      { kind: 'move', dx: 5, dy: 5 },
      { kind: 'move', dx: 0, dy: 20 },
    ]);
  });

  it('sensitivity scales the move and no fraction is lost', () => {
    const touches = [down(1, 0, 0), move(1, 20, 0)];
    for (let x = 21; x <= 30; x += 1) touches.push(move(1, x, 0));
    const slow = run(touches, 0.5);
    expect(slow.reduce((sum, o) => sum + (o.kind === 'move' ? o.dx : 0), 0)).toBe(15);
    expect(run([down(1, 0, 0), move(1, 20, 0)], 2)).toEqual([{ kind: 'move', dx: 40, dy: 0 }]);
  });

  it('a two-finger tap is a right click, whichever finger leaves first', () => {
    expect(run([down(1, 40, 40), down(2, 90, 40, 30), up(1, 100), up(2, 120)])).toEqual([
      { kind: 'click', button: 'right' },
    ]);
    expect(run([down(1, 40, 40), down(2, 90, 40, 30), up(2, 100), up(1, 120)])).toEqual([
      { kind: 'click', button: 'right' },
    ]);
  });

  it('two fingers sliding scroll: the content follows the fingers', () => {
    const step = SCROLL_PX * 4;
    // both fingers go up by `step`: the view goes down
    const out = run([
      down(1, 40, 200),
      down(2, 90, 200),
      move(1, 40, 200 - step),
      move(2, 90, 200 - step),
    ]);
    const total = out.reduce((sum, o) => sum + (o.kind === 'scroll' ? o.dy : 0), 0);
    expect(total).toBe(4);
    expect(out.every((o) => o.kind === 'scroll')).toBe(true);
    // sideways: fingers to the left, the view to the right
    const side = run([
      down(1, 200, 40),
      down(2, 200, 90),
      move(1, 200 - step, 40),
      move(2, 200 - step, 90),
    ]);
    expect(side.reduce((sum, o) => sum + (o.kind === 'scroll' ? o.dx : 0), 0)).toBe(4);
  });

  it('after two fingers the one that stays neither moves the pointer nor clicks', () => {
    const out = run([
      down(1, 40, 40),
      down(2, 90, 40),
      move(1, 40, 100),
      move(2, 90, 100),
      up(2, 300),
      move(1, 140, 100),
      up(1, 320),
    ]);
    expect(out.every((o) => o.kind === 'scroll')).toBe(true);
  });

  it('three fingers do nothing, and a touch the system took away never clicks', () => {
    expect(
      run([down(1, 10, 10), down(2, 60, 10), down(3, 110, 10), up(1, 50), up(2, 60), up(3, 70)]),
    ).toEqual([]);
    expect(run([down(1, 10, 10), { type: 'cancel', id: 1 }])).toEqual([]);
    // a touch that began elsewhere is not ours
    expect(run([move(7, 10, 10), up(7, 20)])).toEqual([]);
  });
});
