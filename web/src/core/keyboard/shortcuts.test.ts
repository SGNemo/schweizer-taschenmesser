// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import { CHORD_MS, createShortcutHandler, type ShortcutContext } from './shortcuts';

let t0: number;
let ctx: ShortcutContext & { calls: string[] };
let handle: ReturnType<typeof createShortcutHandler>;

const press = (
  key: string,
  init: Partial<KeyboardEventInit> = {},
  target: EventTarget = document.body,
) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  handle(e);
  return e;
};

beforeEach(() => {
  t0 = 1_000_000;
  setNow(() => t0);
  const calls: string[] = [];
  ctx = {
    calls,
    destination: (l) =>
      ({ h: '/', p: '/planen', g: '/geld', a: undefined, w: '/wissen', t: '/tresor' })[l],
    go: (to) => calls.push(`go ${to}`),
    quickAdd: () => calls.push('quickAdd'),
    showShortcuts: () => calls.push('sheet'),
    undo: () => calls.push('undo'),
  };
  handle = createShortcutHandler(ctx);
  document.body.innerHTML = '';
});
afterEach(() => setNow());

describe('global shortcuts', () => {
  it('N opens quick capture, ? the sheet, Ctrl+Z undoes', () => {
    press('n');
    press('?');
    press('z', { ctrlKey: true });
    expect(ctx.calls).toEqual(['quickAdd', 'sheet', 'undo']);
  });

  it('G then a letter goes to that area; an unavailable or late second key does nothing', () => {
    press('g');
    press('p');
    press('g');
    press('a'); // Haushalt is not enabled
    press('g');
    t0 += CHORD_MS + 1;
    press('t');
    expect(ctx.calls).toEqual(['go /planen']);
  });

  it('the chord letter is swallowed so module shortcuts (accounts P/T) do not fire', () => {
    press('g');
    const second = press('t');
    expect(second.defaultPrevented).toBe(true);
    expect(ctx.calls).toEqual(['go /tresor']);
  });

  it('never fires while typing, with Ctrl/Alt held, or while a dialog is open', () => {
    const input = document.createElement('input');
    document.body.append(input);
    press('n', {}, input);
    press('n', { altKey: true });
    press('z', { ctrlKey: true }, input); // text undo stays native
    expect(ctx.calls).toEqual([]);

    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    press('n');
    expect(ctx.calls).toEqual([]);
  });
});

describe('list keys', () => {
  function rows(n: number) {
    document.body.innerHTML = `<main><ul>${Array.from(
      { length: n },
      (_, i) =>
        `<li><button data-row id="r${i}">Zeile ${i}</button><button data-row-edit id="e${i}">E</button><input type="checkbox" data-row-tick id="t${i}"></li>`,
    ).join('')}</ul><input data-list-search id="s"></main>`;
  }

  it('J and K move focus between rows, clamped at the ends', () => {
    rows(3);
    press('j');
    expect(document.activeElement?.id).toBe('r0');
    press('j');
    press('j');
    press('j');
    expect(document.activeElement?.id).toBe('r2');
    press('k');
    expect(document.activeElement?.id).toBe('r1');
  });

  it('arrows drive the list only once a row has focus', () => {
    rows(2);
    const before = press('ArrowDown');
    expect(before.defaultPrevented).toBe(false);
    document.getElementById('r0')!.focus();
    const e = press('ArrowDown');
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('r1');
  });

  it('E opens the row through its main button when there is no edit hook', () => {
    document.body.innerHTML =
      '<main><ul><li><button data-row id="only">A</button></li></ul></main>';
    const open = vi.fn();
    document.getElementById('only')!.addEventListener('click', open);
    document.getElementById('only')!.focus();
    press('e');
    expect(open).toHaveBeenCalledOnce();
  });

  it('E presses the row edit hook, Space the tick hook, / focuses the search', () => {
    rows(1);
    const edit = vi.fn();
    const tick = vi.fn();
    document.getElementById('e0')!.addEventListener('click', edit);
    document.getElementById('t0')!.addEventListener('click', tick);
    document.getElementById('r0')!.focus();
    press('e');
    press(' ');
    expect(edit).toHaveBeenCalledOnce();
    expect(tick).toHaveBeenCalledOnce();
    press('/');
    expect(document.activeElement?.id).toBe('s');
  });
});
