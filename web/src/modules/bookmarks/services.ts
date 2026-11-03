import { bus } from '@/core/events';
import { normalizeUrl } from './logic';
import { fetchPreviewFor, previewEnabled } from './preview';
import { itemRepo } from './repo';
import { KINDS, type Kind } from './schema';

/** Stores a requested link once (same address = same entry). */
export async function addRequested(req: {
  title: string;
  url: string;
  note?: string;
  kind?: string;
  tags?: string[];
}): Promise<void> {
  const url = normalizeUrl(req.url);
  if (!url) return;
  const existing = await itemRepo.active().toArray();
  if (existing.some((i) => i.url === url)) return;
  const created = await itemRepo.create({
    title: req.title.trim() || url,
    url,
    kind: (KINDS as readonly string[]).includes(req.kind ?? '') ? (req.kind as Kind) : 'read',
    tags: [...new Set((req.tags ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 10),
    note: req.note,
    done: false,
    started: false,
  });
  if (await previewEnabled()) void fetchPreviewFor(created.id, url);
}

/** Runs while the bookmarks module is enabled: reacts to `bookmark.requested`. */
export default function start(): () => void {
  return bus.on('bookmark.requested', (req) => addRequested(req));
}
