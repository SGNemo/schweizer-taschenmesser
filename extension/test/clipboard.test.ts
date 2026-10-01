import { describe, expect, it } from 'vitest';
import { CLEAR_AFTER_MS, createSecretClipboard } from '../src/lib/clipboard';

function setup(readable = true) {
  let content = '';
  const writes: string[] = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let next = 1;
  const board = createSecretClipboard(
    {
      async write(text) {
        content = text;
        writes.push(text);
      },
      async read() {
        return readable ? content : null;
      },
    },
    {
      set: (fn, ms) => {
        const id = next++;
        timers.push({ fn, ms, id });
        return id;
      },
      clear: (id) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
    },
  );
  return { board, writes, timers, set: (v: string) => (content = v), get: () => content };
}

describe('secret clipboard', () => {
  it('clears after 30 seconds when the secret is still there', async () => {
    const c = setup();
    await c.board.copy('geheim');
    expect(c.timers[0]?.ms).toBe(CLEAR_AFTER_MS);
    c.timers[0]!.fn();
    await new Promise((r) => setTimeout(r, 0)); // let the async clear finish
    expect(c.get()).toBe('');
  });
  it('leaves something the user copied in the meantime alone', async () => {
    const c = setup();
    await c.board.copy('geheim');
    c.set('etwas anderes');
    await c.board.flush();
    expect(c.get()).toBe('etwas anderes');
  });
  it('leaves an unreadable clipboard alone', async () => {
    const c = setup(false);
    await c.board.copy('geheim');
    await c.board.flush();
    expect(c.writes).toEqual(['geheim']);
  });
  it('a second copy replaces the pending timer', async () => {
    const c = setup();
    await c.board.copy('eins');
    await c.board.copy('zwei');
    expect(c.timers).toHaveLength(1);
    await c.board.flush();
    expect(c.get()).toBe('');
  });
});
