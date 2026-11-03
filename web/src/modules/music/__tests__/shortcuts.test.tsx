// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { settings as moduleSettings } from '../settings';
import { useShortcuts } from '../useShortcuts';
import type { NowPlayingHandle } from '../useNowPlaying';

function Host(props: {
  np: Partial<NowPlayingHandle>;
  enabled?: boolean;
  openSearch?: () => void;
  trackId?: string;
}) {
  useShortcuts(
    props.np as NowPlayingHandle,
    props.enabled ?? true,
    props.openSearch ?? (() => {}),
    props.trackId,
  );
  return <input aria-label="feld" />;
}

const handle = (over: Partial<NowPlayingHandle> = {}) => {
  const control = vi.fn(async (_command: string) => {});
  return {
    control,
    np: {
      canControl: true,
      current: { title: 't', artist: 'a', playing: true },
      run: async (fn: () => Promise<void>) => (await fn(), true),
      control,
      ...over,
    } as Partial<NowPlayingHandle>,
  };
};

describe('music keyboard shortcuts', () => {
  it('are on by default (a setting)', () => {
    expect(moduleSettings.defaults).toMatchObject({ shortcuts: true });
  });

  it('Space pauses what plays, Shift+arrows skip, "/" opens the search', () => {
    const { np, control } = handle();
    const openSearch = vi.fn();
    render(<Host np={np} openSearch={openSearch} />);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(window, { key: '/' });
    expect(control.mock.calls.map((c) => c[0])).toEqual(['pause', 'next', 'previous']);
    expect(openSearch).toHaveBeenCalledOnce();
  });

  it('Space starts the player when it is paused', () => {
    const { np, control } = handle({ current: { title: 't', artist: 'a', playing: false } });
    render(<Host np={np} />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(control).toHaveBeenCalledWith('play');
  });

  it('L saves the playing song, or removes it when it was saved', async () => {
    const save = vi.fn(async () => {});
    const saved = vi.fn(async () => [false]);
    const { np } = handle({ source: { saved, save } as never, ctx: {} as never });
    render(<Host np={np} trackId="abc123" />);
    fireEvent.keyDown(window, { key: 'l' });
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith({}, ['abc123'], true));
    saved.mockResolvedValueOnce([true]);
    fireEvent.keyDown(window, { key: 'L' });
    await vi.waitFor(() => expect(save).toHaveBeenLastCalledWith({}, ['abc123'], false));
  });

  it('stay quiet while typing, with a modifier, when switched off or when nothing can be controlled', () => {
    const { np, control } = handle();
    const { getByLabelText, rerender } = render(<Host np={np} />);
    fireEvent.keyDown(getByLabelText('feld'), { key: ' ' });
    fireEvent.keyDown(window, { key: ' ', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' }); // without Shift
    rerender(<Host np={np} enabled={false} />);
    fireEvent.keyDown(window, { key: ' ' });
    rerender(<Host np={handle({ canControl: false }).np} />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(control).not.toHaveBeenCalled();
  });
});
