import { useEffect } from 'react';
import type { DueNotification } from '@/core/modules/types';
import { useCenterStore } from './centerStore';
import { loadOpen } from './center';

const REFRESH_MS = 30_000;

/** Reloads the open list into the store; call after every action that changes it. */
export async function refreshOpen(): Promise<DueNotification[]> {
  const open = await loadOpen();
  useCenterStore.getState().setOpenList(open);
  return open;
}

/** Keeps the open count fresh (start, every 30 s, when the app becomes visible); mounted once by the bell. */
export function useOpenReminders(): DueNotification[] {
  const open = useCenterStore((s) => s.open);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible')
        void refreshOpen().catch((e) => console.error('[notifications] open list failed', e));
    };
    tick();
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return open;
}
