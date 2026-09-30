import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getPlatform } from '@/core/platform';

/**
 * Android: turns text shared from another app into a visit of `/share`, the same page the PWA
 * share target uses. The plugin hands over the launching share at start and later ones when the app
 * comes back to the foreground (singleTask activity), so both moments are checked.
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
