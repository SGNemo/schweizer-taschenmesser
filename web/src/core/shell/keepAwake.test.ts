import { beforeEach, describe, expect, it, vi } from 'vitest';

const display = vi.hoisted(() => ({ setKeepAwake: vi.fn(async (_on: boolean) => undefined) }));
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ display }) }));

import { holdKeepAwake } from './keepAwake';

beforeEach(() => display.setKeepAwake.mockClear());

describe('holdKeepAwake', () => {
  it('the screen may sleep again only when the last hold is gone', () => {
    const cockpit = holdKeepAwake();
    const remote = holdKeepAwake();
    expect(display.setKeepAwake.mock.calls).toEqual([[true]]);
    remote();
    // the remote page was left: the cockpit still holds
    expect(display.setKeepAwake.mock.calls).toEqual([[true]]);
    remote();
    expect(display.setKeepAwake.mock.calls).toEqual([[true]]);
    cockpit();
    expect(display.setKeepAwake.mock.calls).toEqual([[true], [false]]);
  });
});
