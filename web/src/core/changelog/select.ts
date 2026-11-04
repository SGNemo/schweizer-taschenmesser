/** Which part of the embedded changelog belongs to the running build (pure; no I/O). */
import { compareSemver, parseSemver } from '@/core/update/semver';
import {
  UNRELEASED,
  type ChangelogData,
  type ChangelogEntry,
  type ChangelogVersion,
} from './types';

export interface ChangelogView {
  /** Notes not yet released (Dev-Preview / pre-release builds only; the data holds them only there). */
  unreleased?: ChangelogVersion;
  /** The running version, if the data has it. */
  current?: ChangelogVersion;
  /** Earlier released versions, newest first. */
  older: ChangelogVersion[];
}

/** "1.2.0-dev.57+abc1234" → "1.2.0-dev.57"; "v1.2.0" → "1.2.0". */
export const stripBuild = (v: string): string => v.trim().replace(/^v/, '').replace(/\+.*$/, '');

export function selectChangelog(data: ChangelogData, runningVersion: string): ChangelogView {
  const running = stripBuild(runningVersion);
  const released = data.versions.filter((v) => v.version !== UNRELEASED && parseSemver(v.version));
  const sorted = [...released].sort((a, b) => compareSemver(b.version, a.version));
  const unreleased = data.versions.find((v) => v.version === UNRELEASED && v.entries.length > 0);
  // A dev/beta build of 1.1.0 is not 1.1.0 yet: it shows the unreleased notes, then 1.0.0 and older.
  const exact = sorted.find((v) => v.version === running);
  const current = exact;
  const parsed = parseSemver(running);
  // A dev/beta build of 1.1.0 sorts below 1.1.0 but is built on it: everything up to its base is "older".
  const upTo = parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : running;
  const older = sorted.filter(
    (v) => v !== current && (!parsed || compareSemver(v.version, upTo) <= 0),
  );
  return { ...(unreleased ? { unreleased } : {}), ...(current ? { current } : {}), older };
}

export interface AreaGroup {
  area: string;
  label: string;
  entries: ChangelogEntry[];
}

/** Highlights are shown on their own; the rest is grouped by area (alphabetical), breaking first. */
export function groupForDisplay(
  version: ChangelogVersion,
  data: ChangelogData,
  lang: string,
): { highlights: ChangelogEntry[]; groups: AreaGroup[] } {
  const l: 'de' | 'en' = lang === 'de' ? 'de' : 'en';
  const label = (area: string) => data.areas[area]?.[l] ?? area;
  const highlights = version.entries.filter((e) => e.highlight);
  const rest = version.entries.filter((e) => !e.highlight);
  const byArea = new Map<string, ChangelogEntry[]>();
  for (const e of rest) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const groups = [...byArea.entries()]
    .map(([area, entries]) => ({
      area,
      label: label(area),
      entries: [...entries].sort((a, b) => Number(b.breaking) - Number(a.breaking)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, l));
  return { highlights, groups };
}

/** The entry text in the app language; every other language falls back to English. */
export const entryText = (e: ChangelogEntry, lang: string): string => (lang === 'de' ? e.de : e.en);
