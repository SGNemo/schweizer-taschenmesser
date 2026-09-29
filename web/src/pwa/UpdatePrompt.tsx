import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';

/** Registers the service worker and offers a reload when a new version is waiting. */
export function UpdatePrompt() {
  const toast = useUiStore((s) => s.toast);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh) {
      toast(t.pwa.updateAvailable, {
        label: t.actions.update,
        run: () => void updateServiceWorker(true),
      });
    }
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}
