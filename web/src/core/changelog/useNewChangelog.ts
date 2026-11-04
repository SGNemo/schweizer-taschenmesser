import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { loadChangelog } from './load';
import { newToken, selectChangelog } from './select';
import { SEEN_EVENT, isUnread, loadHint, loadSeen } from './seen';

/**
 * True while there are changes of this build the user has not opened yet (and the quiet "new" mark is
 * on). Reads only the embedded data and device-local `_meta`; any failure means "nothing new".
 */
export function useNewChangelog(): boolean {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const [version, data, seen, hint] = await Promise.all([
          getPlatform().app.version(),
          loadChangelog(),
          loadSeen(),
          loadHint(),
        ]);
        if (alive) setFresh(hint && isUnread(seen, newToken(selectChangelog(data, version))));
      } catch {
        if (alive) setFresh(false);
      }
    };
    void check();
    window.addEventListener(SEEN_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(SEEN_EVENT, check);
    };
  }, []);
  return fresh;
}
