import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { offerEnableModule } from '@/core/modules/offerEnable';
import { loadModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';

/**
 * Desktop: a magnet link or `.torrent` file the app was started with (optional OS association) opens
 * the add dialog of the Downloads module, pre-filled. Nothing is added before the user confirms there.
 */
export function useLaunchOpen(): void {
  const navigate = useNavigate();
  useEffect(() => {
    const launch = getPlatform().launch;
    let alive = true;
    let stop = () => undefined as void;
    const take = () => {
      void launch.takePending().then(
        async (value) => {
          if (!alive || !value) return;
          const go = () => void navigate(`/downloads?add=${encodeURIComponent(value)}`);
          const states = await loadModuleStates();
          if (states.downloads) go();
          else offerEnableModule('downloads', t.downloads.torrent.launch.needModule, go);
        },
        () => undefined,
      );
    };
    take();
    void launch.onOpen(take).then((off) => {
      if (alive) stop = off;
      else off();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [navigate]);
}
