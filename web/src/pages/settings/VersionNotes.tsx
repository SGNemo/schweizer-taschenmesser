import { entryText, groupForDisplay } from '@/core/changelog/select';
import type { NoteBlock } from '@/core/changelog/notes';
import type { ChangelogData, ChangelogEntry, ChangelogVersion } from '@/core/changelog/types';
import { ReleaseNotes } from '@/layout/ReleaseNotes';
import { t } from '@/strings';

/** The changes of one version from the embedded data: highlights first, then by area. */
export function VersionNotes({
  version,
  data,
  lang,
}: {
  version: ChangelogVersion;
  data: ChangelogData;
  lang: string;
}) {
  const c = t.about.changes;
  const { highlights, groups } = groupForDisplay(version, data, lang);
  const areaLabel = (e: ChangelogEntry) =>
    data.areas[e.area]?.[lang === 'de' ? 'de' : 'en'] ?? e.area;
  const blocks: NoteBlock[] = [
    ...(highlights.length > 0
      ? [
          {
            heading: c.highlights,
            items: highlights.map((e) => ({ lead: `${areaLabel(e)}:`, text: entryText(e, lang) })),
          },
        ]
      : []),
    ...groups.map((g) => ({
      heading: g.label,
      items: g.entries.map((e) => ({
        ...(e.breaking ? { lead: c.breaking.trim() } : {}),
        text: entryText(e, lang),
      })),
    })),
  ];
  return <ReleaseNotes blocks={blocks} />;
}
