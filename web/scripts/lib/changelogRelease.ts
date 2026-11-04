/**
 * Release changelog from change notes: grouping, Markdown (English + German) and the data file the
 * app reads. Pure functions; the CLI is `../changelog-release.mjs`. Erasable TypeScript only.
 */
import { AREAS, TYPES, type ChangeEntry, type ChangeType } from './changes.ts';

export type Lang = 'de' | 'en';

export interface VersionData {
  /** 'x.y.z' (or a pre-release); 'unreleased' for the notes not yet in a release. */
  version: string;
  /** 'YYYY-MM-DD'; '' for unreleased. */
  date: string;
  entries: ChangeEntry[];
}
export interface ChangelogData {
  areas: Record<string, { de: string; en: string }>;
  /** Newest first. */
  versions: VersionData[];
}

const HEADINGS: Record<Lang, Record<ChangeType | 'highlights' | 'breaking', string>> = {
  en: {
    highlights: 'Highlights',
    breaking: 'Breaking changes',
    added: 'Added',
    changed: 'Changed',
    fixed: 'Fixed',
    removed: 'Removed',
    security: 'Security',
    performance: 'Performance',
  },
  de: {
    highlights: 'Highlights',
    breaking: 'Wichtig vor dem Update',
    added: 'Neu',
    changed: 'Geändert',
    fixed: 'Behoben',
    removed: 'Entfernt',
    security: 'Sicherheit',
    performance: 'Geschwindigkeit',
  },
};

const areaLabel = (area: string, lang: Lang): string => AREAS[area]?.[lang] ?? area;
const byArea = (lang: Lang) => (a: ChangeEntry, b: ChangeEntry) =>
  areaLabel(a.area, lang).localeCompare(areaLabel(b.area, lang), lang);
const line = (e: ChangeEntry, lang: Lang): string => `- **${areaLabel(e.area, lang)}:** ${e[lang]}`;

/** Buckets in display order: breaking, highlights, then one per type; an entry appears once. */
export function groupEntries(
  entries: ChangeEntry[],
): { key: ChangeType | 'highlights' | 'breaking'; entries: ChangeEntry[] }[] {
  const left = [...entries];
  const take = (pred: (e: ChangeEntry) => boolean) => {
    const out = left.filter(pred);
    for (const e of out) left.splice(left.indexOf(e), 1);
    return out;
  };
  const groups: { key: ChangeType | 'highlights' | 'breaking'; entries: ChangeEntry[] }[] = [
    { key: 'breaking', entries: take((e) => e.breaking) },
    { key: 'highlights', entries: take((e) => e.highlight) },
    ...TYPES.map((type) => ({ key: type, entries: take((e) => e.type === type) })),
  ];
  return groups.filter((g) => g.entries.length > 0);
}

/** `## [x.y.z] – date` section, Keep-a-Changelog style, in one language. */
export function renderSection(v: VersionData, lang: Lang): string {
  const head = `## [${v.version}] – ${v.date}`;
  const parts = groupEntries(v.entries).map((g) =>
    [
      `### ${HEADINGS[lang][g.key]}`,
      ...[...g.entries].sort(byArea(lang)).map((e) => line(e, lang)),
    ].join('\n'),
  );
  return [head, ...parts].join('\n\n') + '\n';
}

/** Puts `section` above the newest existing `## ` heading; replaces a section of the same version. */
export function insertSection(markdown: string, section: string, version: string): string {
  const lines = markdown.split('\n');
  const isHead = (l: string) => /^##\s+(?!#)/.test(l);
  const own = lines.findIndex((l) => isHead(l) && l.startsWith(`## [${version}]`));
  if (own !== -1) {
    const next = lines.findIndex((l, i) => i > own && isHead(l));
    lines.splice(own, (next === -1 ? lines.length : next) - own);
  }
  // Drop an empty "Unreleased" heading: the notes folder replaces it.
  const unrel = lines.findIndex((l) => /^##\s+Unreleased\s*$/i.test(l));
  if (unrel !== -1) {
    const next = lines.findIndex((l, i) => i > unrel && isHead(l));
    lines.splice(unrel, (next === -1 ? lines.length : next) - unrel);
  }
  const first = lines.findIndex(isHead);
  const at = first === -1 ? lines.length : first;
  lines.splice(at, 0, ...section.trimEnd().split('\n'), '');
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n*$/, '\n');
}

/** Adds (or replaces) a version in the data; keeps `versions` newest first by insertion. */
export function upsertVersion(data: ChangelogData, v: VersionData): ChangelogData {
  const versions = [v, ...data.versions.filter((x) => x.version !== v.version)];
  const used = new Set(versions.flatMap((x) => x.entries.map((e) => e.area)));
  const areas: ChangelogData['areas'] = {};
  for (const id of [...used].sort()) areas[id] = AREAS[id] ?? { de: id, en: id };
  return { areas, versions };
}
