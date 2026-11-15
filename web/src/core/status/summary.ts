import { t } from '@/strings';
import type { StatusLine } from './lines';

/** Route of the page "Gerätestatus" (module `device`); the core names it so the settings can lead there. */
export const DEVICE_STATUS_PATH = '/device';

/** The lines that need a look, in the order given. */
export const needingLook = (lines: readonly StatusLine[]): StatusLine[] =>
  lines.filter((l) => l.attention);

/**
 * A state with its line's name in front, unless the state already names it ("Letztes Backup fehlgeschlagen",
 * "Update verfügbar" under "Updates": the name is compared without a plural "s", which holds in German and English).
 */
export function withTitle(line: Pick<StatusLine, 'title' | 'status'>): string {
  const stem = line.title.toLowerCase().replace(/s$/, '');
  return line.status.toLowerCase().includes(stem) ? line.status : `${line.title}: ${line.status}`;
}

/**
 * The line nothing needs a look at, but whose state is worth naming calmly (no backup yet: the only risk of losing
 * data). Never a point, never red; only the words change.
 */
export const calmPoint = (lines: readonly StatusLine[]): StatusLine | undefined =>
  // Only the backup line: the words below ("Noch kein Backup") name it, whatever other line might set `missing`.
  needingLook(lines).length === 0
    ? lines.find((l) => l.id === 'backup' && l.missing && !l.loading)
    : undefined;

/**
 * "Nichts Dringendes", "Noch kein Backup" or what needs a look, as one sentence: the one line's own state, or a count.
 */
export function summaryText(lines: readonly StatusLine[]): string {
  const look = needingLook(lines);
  const s = t.device.summary;
  if (look.length === 0) return calmPoint(lines) ? s.noBackup : s.ok;
  if (look.length === 1) return withTitle(look[0]!);
  return s.look(look.length);
}

/**
 * The one line the settings show instead of sync, backup, updates and storage while the module "Gerätestatus" is
 * switched on: the summary, and a link to the page that holds the four.
 */
export function deviceStatusLine(lines: readonly StatusLine[]): StatusLine {
  return {
    id: 'device',
    to: DEVICE_STATUS_PATH,
    icon: 'activity',
    title: t.device.meta.name,
    status: summaryText(lines),
    context: t.device.summary.settingsContext,
    attention: needingLook(lines).length > 0,
    testId: 'overview-device',
  };
}
