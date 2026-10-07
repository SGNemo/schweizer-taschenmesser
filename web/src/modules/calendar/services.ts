import { settingsRepo, setSettings } from '@/core/settings/settings';

/**
 * One-time carry-over of the retired `reminders` module's default time into
 * `defaultReminderTime`, unless that was already chosen here.
 */
export async function carryOverSettings(): Promise<void> {
  const here = await settingsRepo.get('module.calendar');
  if (here && 'defaultReminderTime' in here) return;
  const old = await settingsRepo.get('module.reminders');
  if (typeof old?.defaultTime === 'string')
    await setSettings('module.calendar', { defaultReminderTime: old.defaultTime });
}

export default function start(): () => void {
  void carryOverSettings();
  return () => undefined;
}
