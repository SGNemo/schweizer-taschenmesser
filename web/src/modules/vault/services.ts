import { settingsRepo, setSettings } from '@/core/settings/settings';

/**
 * One-time carry-over of the retired `contracts` reminder lead (days before the cancellation
 * deadline) into `remindDaysBeforeDeadline`, unless that setting was already chosen here.
 */
export async function carryOverSettings(): Promise<void> {
  const here = await settingsRepo.get('module.vault');
  if (here && 'remindDaysBeforeDeadline' in here) return;
  const old = await settingsRepo.get('module.contracts');
  if (typeof old?.remindDaysBefore === 'number')
    await setSettings('module.vault', { remindDaysBeforeDeadline: old.remindDaysBefore });
}

export default function start(): () => void {
  void carryOverSettings();
  return () => undefined;
}
