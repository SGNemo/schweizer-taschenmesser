/** "Changes in this version" plus older versions, from the embedded changelog data (offline). */
import { useEffect, useState } from 'react';
import { loadChangelog } from '@/core/changelog/load';
import { entryText, groupForDisplay, selectChangelog } from '@/core/changelog/select';
import { isUnread, loadHint, loadSeen, markSeen, saveHint } from '@/core/changelog/seen';
import type { ChangelogData, ChangelogEntry, ChangelogVersion } from '@/core/changelog/types';
import { useLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
import type { NoteBlock } from '@/core/changelog/notes';
import { ReleaseNotes } from '@/layout/ReleaseNotes';
import { t } from '@/strings';
import { SettingRow, Switch } from '@/ui';
import styles from './settings.module.css';

function VersionBody({
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

export function ChangelogList({ version }: { version: string }) {
  const lang = useLang();
  const [data, setData] = useState<ChangelogData | undefined>();
  const [seen, setSeen] = useState<string[]>([]);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    void loadChangelog().then(setData);
    void loadSeen().then(setSeen);
    void loadHint().then(setHint);
  }, []);
  const c = t.about.changes;
  const view = data ? selectChangelog(data, version) : undefined;
  const open = (v: string) => {
    void markSeen(v).then(() => loadSeen().then(setSeen));
  };
  const unread = hint && isUnread(seen, view?.current?.version);
  const dateOf = (v: ChangelogVersion) =>
    v.date
      ? ` · ${dateTimeFormat({ dateStyle: 'medium' }).format(new Date(v.date + 'T00:00:00'))}`
      : '';
  // The newest notes are open without a click: the unreleased ones in a preview, else the running version.
  const openFirst = view?.unreleased ? 'unreleased' : view?.current?.version;
  useEffect(() => {
    if (hint && view?.current && openFirst === view.current.version) open(view.current.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFirst, !!view?.current]);
  const block = (v: ChangelogVersion, title: string, isCurrent = false) =>
    data ? (
      <details
        className={styles.details}
        key={v.version}
        data-testid={`changelog-${v.version}`}
        onToggle={(e) => e.currentTarget.open && open(v.version)}
        open={v.version === openFirst || undefined}
      >
        <summary>
          {title}
          {isCurrent && unread ? <span data-testid="changelog-new"> · {c.fresh}</span> : null}
        </summary>
        <VersionBody version={v} data={data} lang={lang} />
      </details>
    ) : null;
  return (
    <>
      {view?.unreleased ? block(view.unreleased, `${c.unreleased} · ${c.unreleasedNote}`) : null}
      {view?.current ? (
        block(view.current, `${c.version(view.current.version)}${dateOf(view.current)}`, true)
      ) : view?.unreleased ? null : (
        <details className={styles.details}>
          <summary>{t.about.updates.current}</summary>
          <p className={styles.muted}>{t.about.updates.none}</p>
        </details>
      )}
      {view && view.older.length > 0 ? (
        <details className={styles.details}>
          <summary>{c.older}</summary>
          {view.older.map((v) => block(v, `${c.version(v.version)}${dateOf(v)}`))}
        </details>
      ) : null}
      <SettingRow id="about-updates--hint" label={c.hint} description={c.hintDescription}>
        <Switch
          checked={hint}
          onChange={(on: boolean) => {
            setHint(on);
            void saveHint(on);
          }}
          label={c.hint}
          labelHidden
        />
      </SettingRow>
    </>
  );
}
