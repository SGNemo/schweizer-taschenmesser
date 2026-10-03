import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { markAway, recordContext } from '@/core/focus/context';
import { now } from '@/core/time/now';

/** Headless: remembers the current place for "Woran war ich?" and marks when the app is left. */
export function ResumeTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // The page title is rendered a moment after the route changes.
    const id = setTimeout(
      () =>
        void recordContext(
          pathname + search,
          document.querySelector('main h1')?.textContent ?? '',
        ).catch(() => undefined),
      400,
    );
    return () => clearTimeout(id);
  }, [pathname, search]);

  useEffect(() => {
    const leave = () => {
      if (document.visibilityState === 'hidden') void markAway(now()).catch(() => undefined);
    };
    const gone = () => void markAway(now()).catch(() => undefined);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', gone);
    return () => {
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('pagehide', gone);
    };
  }, []);

  return null;
}
