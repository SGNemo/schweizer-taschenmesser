import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { ShortcutTarget } from '@/core/platform/types';
import { useUiStore } from '@/stores/ui';

/** What a launcher shortcut or the quick-settings tile opens (same as the PWA shortcuts). */
function openShortcut(target: ShortcutTarget, navigate: (to: string) => unknown): void {
  const ui = useUiStore.getState();
  if (target === 'capture') ui.setQuickAddOpen(true);
  else if (target === 'search') ui.setPaletteOpen(true);
  else void navigate('/');
}

/**
 * Android: turns text shared from another app into a visit of `/share`, the same page the PWA
 * share target uses. The plugin hands over the launching share at start and later ones when the app
 * comes back to the foreground (singleTask activity), so both moments are checked. A launcher
 * shortcut or the quick-settings tile arrives the same way and opens capture, search or Heute.
 */
export function useNativeShare(): void {
  const navigate = useNavigate();
  useEffect(() => {
    const share = getPlatform().share;
    if (!share.supported) return;
    let alive = true;
    const check = () => {
      void share.takePending().then(
        (shared) => {
          if (!alive || !shared) return;
          // A shortcut alone carries no text; should a share wait as well, the share wins.
          if (shared.open && !shared.title.trim() && !shared.text.trim()) {
            openShortcut(shared.open, navigate);
            return;
          }
          const q = new URLSearchParams({ title: shared.title, text: shared.text });
          void navigate(`/share?${q.toString()}`);
        },
        () => undefined,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [navigate]);
}
