import { bus } from '@/core/events';
import { normalizeUrl } from './logic';
import { itemRepo } from './repo';

/** Stores a requested link once (same address = same entry). */
export async function addRequested(req: {
  title: string;
  url: string;
  note?: string;
}): Promise<void> {
  const url = normalizeUrl(req.url);
  if (!url) return;
  const existing = await itemRepo.active().toArray();
  if (existing.some((i) => i.url === url)) return;
  await itemRepo.create({
    title: req.title.trim() || url,
    url,
    kind: 'read',
    tags: [],
    note: req.note,
    done: false,
  });
}

/** Runs while the bookmarks module is enabled: reacts to `bookmark.requested`. */
export default function start(): () => void {
  return bus.on('bookmark.requested', (req) => addRequested(req));
}
