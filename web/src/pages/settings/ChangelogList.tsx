/** "Changes in this version" plus older versions, from the embedded changelog data (offline). */
import { useEffect, useState } from 'react';
import { loadChangelog } from '@/core/changelog/load';
import { entryText, groupForDisplay, selectChangelog } from '@/core/changelog/select';
import { isUnread, loadHint, loadSeen, markSeen, saveHint } from '@/core/changelog/seen';
import type { ChangelogData, ChangelogEntry, ChangelogVersion } from '@/core/changelog/types';
import { useLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
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
  const item = (e: ChangelogEntry, prefix?: string) => (
    <li key={`${e.area}-${e.de}`}>
      {e.breaking ? <strong>{c.breaking}</strong> : null}
      {prefix ? <strong>{prefix} </strong> : null}
      {entryText(e, lang)}
    </li>
  );
  return (
    <div className={styles.notes}>
      {highlights.length > 0 ? (
        <>
          <strong>{c.highlights}</strong>
          <ul>
            {highlights.map((e) => item(e, data.areas[e.area]?.[lang === 'de' ? 'de' : 'en']))}
          </ul>
        </>
      ) : null}
      {groups.map((g) => (
        <div key={g.area}>
          <strong>{g.label}</strong>
          <ul>{g.entries.map((e) => item(e))}</ul>
        </div>
      ))}
    </div>
  );
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
  const block = (v: ChangelogVersion, title: string, extra?: string, isCurrent = false) =>
    data ? (
      <details
        className={styles.details}
        key={v.version}
        data-testid={`changelog-${v.version}`}
        onToggle={(e) => e.currentTarget.open && open(v.version)}
        open={isCurrent && undefined}
      >
        <summary>
          {title}
          {extra ? ` ${extra}` : ''}
          {isCurrent && unread ? <span data-testid="changelog-new"> · {c.fresh}</span> : null}
        </summary>
        <VersionBody version={v} data={data} lang={lang} />
      </details>
    ) : null;
  return (
    <>
      {view?.unreleased ? block(view.unreleased, c.unreleased, `(${c.unreleasedNote})`) : null}
      {view?.current ? (
        block(
          view.current,
          t.about.updates.current,
          `(${view.current.version}${dateOf(view.current)})`,
          true,
        )
      ) : (
        <details className={styles.details}>
          <summary>{t.about.updates.current}</summary>
          <p className={styles.muted}>{t.about.updates.none}</p>
        </details>
      )}
      {view && view.older.length > 0 ? (
        <details className={styles.details}>
          <summary>{c.older}</summary>
          {view.older.map((v) => block(v, c.version(v.version), dateOf(v)))}
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
