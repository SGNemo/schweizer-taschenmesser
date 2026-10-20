// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import type { FKeyAction } from './map';
import {
  CHORD_MS,
  createShortcutHandler,
  matchesVoiceKey,
  releasesVoiceKey,
  type ShortcutContext,
} from './shortcuts';

let t0: number;
let ctx: ShortcutContext & { calls: string[] };
let handle: ReturnType<typeof createShortcutHandler>;
let enabledTools: string[];
let fmap: Record<string, FKeyAction>;

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
  enabledTools = ['timer', 'calc'];
  fmap = { F2: 'quickAdd', F8: 'tool:timer' };
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
    toolAvailable: (id) => enabledTools.includes(id),
    openTool: (id) => calls.push(`tool ${id}`),
    fkeys: () => fmap,
    runAction: (a) => calls.push(`run ${a}`),
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

describe('T chord (tools)', () => {
  it('T then a letter opens that tool and swallows the second key', () => {
    press('t');
    const second = press('r');
    expect(second.defaultPrevented).toBe(true);
    press('t');
    press('t'); // "T dann T" = timer
    expect(ctx.calls).toEqual(['tool calc', 'tool timer']);
  });

  it('a tool that is off or missing is skipped without a message', () => {
    press('t');
    press('q'); // qr is not switched on
    press('t');
    press('v'); // dev has a letter but is not on
    expect(ctx.calls).toEqual([]);
  });

  it('a late second key does not complete the chord (it only starts a new one)', () => {
    press('t');
    t0 += CHORD_MS + 1;
    press('r');
    expect(ctx.calls).toEqual([]);
    press('t');
    t0 += CHORD_MS + 1;
    press('t'); // late: starts again instead of opening the timer
    expect(ctx.calls).toEqual([]);
    press('t');
    expect(ctx.calls).toEqual(['tool timer']);
  });

  it('an unknown letter ends the chord', () => {
    press('t');
    press('x'); // text tool is off, nothing opens
    press('r'); // the chord is spent
    expect(ctx.calls).toEqual([]);
  });

  it('G then T still goes to the vault (the chords do not mix)', () => {
    press('g');
    press('t');
    expect(ctx.calls).toEqual(['go /tresor']);
  });

  it('never starts while typing, with a modifier, in a dialog, or on the vault entry view', () => {
    const input = document.createElement('input');
    document.body.append(input);
    press('t', {}, input);
    press('t', {}, input);
    press('t', { ctrlKey: true });
    press('t');
    expect(ctx.calls).toEqual([]); // the 4th press only armed the chord
    t0 += CHORD_MS + 1;
    document.body.insertAdjacentHTML('beforeend', '<div data-shortcut-scope="entry"></div>');
    press('t');
    press('t');
    expect(ctx.calls).toEqual([]);
  });
});

describe('F-keys', () => {
  it('run the mapped action and swallow the key', () => {
    const e = press('F2');
    press('F8');
    expect(e.defaultPrevented).toBe(true);
    expect(ctx.calls).toEqual(['run quickAdd', 'run tool:timer']);
  });

  it('work inside a text field and while a dialog is open', () => {
    const input = document.createElement('input');
    document.body.append(input);
    press('F2', {}, input);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    press('F8');
    expect(ctx.calls).toEqual(['run quickAdd', 'run tool:timer']);
  });

  it('ignore a held key (repeat) but still keep the browser from acting on it', () => {
    const e = press('F2', { repeat: true });
    expect(e.defaultPrevented).toBe(true);
    expect(ctx.calls).toEqual([]);
  });

  it('leave unmapped keys and keys with a modifier to the browser', () => {
    const f5 = press('F5');
    const f1 = press('F1');
    press('F4', { altKey: true }); // Alt+F4 closes the window
    press('F2', { ctrlKey: true });
    press('F2', { shiftKey: true });
    expect(f5.defaultPrevented || f1.defaultPrevented).toBe(false);
    expect(ctx.calls).toEqual([]);
  });

  it('are not taken while a key recorder records', () => {
    document.body.innerHTML = '<button data-hotkey-recording id="rec">x</button>';
    press('F2', {}, document.getElementById('rec')!);
    expect(ctx.calls).toEqual([]);
  });

  it('read the map at key time (a changed key applies at once)', () => {
    fmap = { F9: 'quickAdd' };
    press('F2');
    press('F9');
    expect(ctx.calls).toEqual(['run quickAdd']);
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

describe('voice key matching', () => {
  const ev = (key: string, code: string, extra: Partial<KeyboardEventInit> = {}) =>
    new KeyboardEvent('keydown', { key, code, ...extra });

  it('matches the configured key, with or without modifiers, and nothing else', () => {
    expect(matchesVoiceKey(ev('F4', 'F4'), 'F4')).toBe(true);
    expect(matchesVoiceKey(ev('F4', 'F4', { ctrlKey: true }), 'F4')).toBe(false);
    expect(matchesVoiceKey(ev('m', 'KeyM', { altKey: true }), 'Alt+M')).toBe(true);
    expect(matchesVoiceKey(ev('F5', 'F5'), 'F4')).toBe(false);
  });

  it('never matches when the key is switched off', () => {
    expect(matchesVoiceKey(ev('F4', 'F4'), '')).toBe(false);
    expect(releasesVoiceKey(ev('F4', 'F4'), '')).toBe(false);
  });

  it('the release only needs the main key (modifiers may be up already)', () => {
    expect(releasesVoiceKey(ev('m', 'KeyM'), 'Alt+M')).toBe(true);
    expect(releasesVoiceKey(ev('n', 'KeyN'), 'Alt+M')).toBe(false);
  });

  it('the shortcut handler leaves F4 alone (the voice hook owns it)', () => {
    const e = press('F4');
    expect(ctx.calls).toEqual([]);
    expect(e.defaultPrevented).toBe(false);
  });
});
