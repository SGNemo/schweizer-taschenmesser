import { loadStoredModuleState } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';

/**
 * E3 (launch review 2026-11): the module is stored as off (also when sync switched it off while the
 * app was closed): the PC's native switch goes off too, so phones hear `exchange-off` and the hub
 * takes nothing more. A narrowing, no dialog. Safe mode only looks like off: the stored state decides.
 */
export default async function off(): Promise<void> {
  const ex = getPlatform().exchange;
  if (ex.side !== 'pc') return;
  const state = await loadStoredModuleState('exchange');
  if (state?.enabled === false) await ex.setEnabled(false).catch(() => undefined);
}
