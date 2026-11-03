import { useEffect, useRef } from 'react';
import type { NowPlayingHandle } from './useNowPlaying';

/** Typing somewhere must never trigger a shortcut. */
const typing = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Keyboard shortcuts of the music page (a setting, on by default): Space plays or pauses, Shift+← / → goes to the previous or
 * next song, L saves or un-saves the song that plays, "/" opens the search. Nothing fires while typing, with Ctrl/Alt/Meta,
 * or when the player cannot be controlled. Nothing is shown or moved by itself.
 */
export function useShortcuts(
  np: NowPlayingHandle | undefined,
  enabled: boolean,
  openSearch: () => void,
  trackId: string | undefined,
): void {
  const latest = useRef({ np, openSearch, trackId });
  useEffect(() => {
    latest.current = { np, openSearch, trackId };
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const { np: player, openSearch: search, trackId: id } = latest.current;
      if (!player || e.ctrlKey || e.altKey || e.metaKey || e.isComposing || typing(e.target))
        return;
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        return search();
      }
      if (!player.canControl) return;
      if (e.key === ' ' && !e.shiftKey) {
        // a focused button keeps its own Space (it clicks itself)
        if (e.target instanceof HTMLElement && ['BUTTON', 'A'].includes(e.target.tagName)) return;
        e.preventDefault();
        void player.run(() => player.control(player.current?.playing ? 'pause' : 'play'));
      } else if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        void player.run(() => player.control('next'));
      } else if (e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        void player.run(() => player.control('previous'));
      } else if (!e.shiftKey && e.key.toLowerCase() === 'l' && id) {
        const { source, ctx } = player;
        if (!source.saved || !source.save) return;
        e.preventDefault();
        void player.run(async () => {
          const [was] = await source.saved!(ctx, [id]);
          await source.save!(ctx, [id], !was);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
