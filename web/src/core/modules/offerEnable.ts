import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { enableModule } from './activation';
import { getManifest } from './registry';
import { whenServicesSettled } from './servicesReady';

/**
 * Tells the user that a feature needs a module that is switched off, and lets them switch it on
 * right there. After the module is on (and its services run) `then` finishes what they were doing,
 * e.g. sends the entry that had nowhere to go. Modules never import each other, so this lives in
 * the core and only needs the module id.
 */
export function offerEnableModule(
  moduleId: string,
  message: string,
  then?: () => void | Promise<void>,
): void {
  const { toast } = useUiStore.getState();
  const manifest = getManifest(moduleId);
  if (!manifest) return void toast(message);
  toast(message, {
    label: t.actions.enable,
    run: () => {
      void (async () => {
        await enableModule(manifest);
        toast(t.library.nowActive(manifest.name), undefined, 'check');
        if (then) {
          // The services of a module that was just switched on start asynchronously.
          await whenServicesSettled();
          await then();
        }
      })();
    },
  });
}
