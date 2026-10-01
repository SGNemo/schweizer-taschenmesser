import { liveQuery } from 'dexie';
import { z } from 'zod';
import { getSettings, settingsRepo } from '@/core/settings/settings';
import { noteRepo } from './repo';
import { SCRATCH_ID } from './logic';

/** The tool "Notizzettel" kept its text in the synced `_settings` scope `tools.scratch`. */
export const LEGACY_SCRATCH_SCOPE = 'tools.scratch';
const legacySchema = z.object({ text: z.string() });

/**
 * One-time, idempotent copy of the old tool text into the scratch note. Only when the note does
 * not exist at all (a tombstone counts as existing) and the text is not empty; the settings row is
 * never touched, so older devices keep working.
 */
export async function ensureScratchNote(): Promise<boolean> {
  const { text } = await getSettings(LEGACY_SCRATCH_SCOPE, legacySchema, { text: '' });
  if (!text.trim()) return false;
  if (await noteRepo.table.get(SCRATCH_ID)) return false;
  await noteRepo.createMany([
    { id: SCRATCH_ID, data: { title: 'Zettel', body: text, pinned: true } },
  ]);
  return true;
}

/** Runs while notes is enabled; also after a sync pull or backup import brings the old text in. */
export default function start(): () => void {
  let running = false;
  let again = false;
  async function run() {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await ensureScratchNote();
      } while (again);
    } finally {
      running = false;
    }
  }
  const sub = liveQuery(() => settingsRepo.get(LEGACY_SCRATCH_SCOPE)).subscribe({
    next: () => void run(),
    error: () => undefined,
  });
  return () => sub.unsubscribe();
}
