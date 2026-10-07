import { settingsRepo, setSettings } from '@/core/settings/settings';

/** One-time carry-over of the birthday reminder settings of the retired `birthdays` module. */
export async function carryOverSettings(): Promise<void> {
  if (await settingsRepo.get('module.people')) return;
  const old = await settingsRepo.get('module.birthdays');
  if (!old) return;
  const patch: Record<string, unknown> = {};
  if (typeof old.remindDaysBefore === 'number') patch.remindDaysBefore = old.remindDaysBefore;
  if (typeof old.remindTime === 'string') patch.remindTime = old.remindTime;
  if (Object.keys(patch).length > 0) await setSettings('module.people', patch);
}

export default function start(): () => void {
  void carryOverSettings();
  return () => undefined;
}
