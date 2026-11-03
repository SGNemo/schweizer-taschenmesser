import { bus } from '@/core/events';
import { settingsRepo, setSettings } from '@/core/settings/settings';
import { addIdea } from './inbox';
import { safeUrl } from './logic';

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
  // Only http(s) links are kept; the title is trimmed to what a gift title can hold.
  return bus.on('gift.requested', (req) => {
    const title = req.title.trim().slice(0, 200);
    if (!title) return;
    const url = req.url ? safeUrl(req.url) : undefined;
    return addIdea({
      title,
      ...(url ? { url } : {}),
      ...(req.priceCents !== undefined ? { priceCents: req.priceCents } : {}),
    });
  });
}
