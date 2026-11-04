import { source as bank } from './bank/source';
import { source as enex } from './enex/source';
import { source as googleCalendar } from './google-calendar/source';
import { source as googleKeep } from './google-keep/source';
import { source as googleTasks } from './google-tasks/source';
import { source as obsidian } from './obsidian/source';
import { source as opml } from './opml/source';
import { source as outlookTasks } from './outlook-tasks/source';
import { source as todoist } from './todoist/source';
import type { Detection, SourceDef, SourceFile } from './types';
import { source as vaultCsv } from './vault-csv/source';

/** All sources, most specific first (ties keep this order). */
export const SOURCES: readonly SourceDef[] = [
  vaultCsv,
  todoist,
  googleTasks,
  outlookTasks,
  googleKeep,
  googleCalendar,
  enex,
  opml,
  obsidian,
  bank,
];

export const sourceById = (id: string): SourceDef | undefined => SOURCES.find((s) => s.id === id);

/** Sources that fit the files, best first. Nothing below 0.3 is offered. */
export function detectSources(files: readonly SourceFile[]): Detection[] {
  return SOURCES.map((source) => ({ source, confidence: source.detect(files) }))
    .filter((d) => d.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence);
}
