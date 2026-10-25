import { describe, expect, it } from 'vitest';
import { orderFKeys } from './ShortcutSheet';

const item = (id: string, key: string) => ({ id, keys: [key], text: id });

describe('shortcut sheet F-key group', () => {
  it('sorts the voice key in among the F-keys by number', () => {
    const out = orderFKeys([item('a', 'F2'), item('b', 'F8')], [item('voice', 'F4')]);
    expect(out.map((i) => i.id)).toEqual(['a', 'voice', 'b']);
  });

  it('keeps a voice key that is not an F-key at the end', () => {
    const out = orderFKeys([item('a', 'F2'), item('b', 'F8')], [item('voice', 'Alt+M')]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'voice']);
  });
});
