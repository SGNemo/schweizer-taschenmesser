/** "Changes in this version" plus older versions, from the embedded changelog data (offline). */
import { useEffect, useRef, useState } from 'react';
import { loadChangelog } from '@/core/changelog/load';
import { newToken, selectChangelog } from '@/core/changelog/select';
import { isUnread, loadHint, loadSeen, markSeen, saveHint } from '@/core/changelog/seen';
import type { ChangelogData, ChangelogVersion } from '@/core/changelog/types';
import { useLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
import { VersionNotes } from './VersionNotes';
import { t } from '@/strings';
import { SettingRow, Switch } from '@/ui';
import styles from './settings.module.css';

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
  const token = view ? newToken(view) : undefined;
  const unread = hint && isUnread(seen, token);
  const dateOf = (v: ChangelogVersion) =>
    v.date
      ? ` · ${dateTimeFormat({ dateStyle: 'medium' }).format(new Date(v.date + 'T00:00:00'))}`
      : '';
  // The newest notes are open without a click: the unreleased ones in a preview, else the running version.
  const openFirst = view?.unreleased ? 'unreleased' : view?.current?.version;
  // Leaving the page counts as having seen the newest notes (they were open); the mark stays while you read.
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(
    () => () => {
      if (tokenRef.current) void markSeen(tokenRef.current);
    },
    [],
  );
  const block = (v: ChangelogVersion, title: string) =>
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
          {v.version === openFirst && unread ? (
            <span data-testid="changelog-new"> · {c.fresh}</span>
          ) : null}
        </summary>
        <VersionNotes version={v} data={data} lang={lang} />
      </details>
    ) : null;
  return (
    <>
      {view?.unreleased ? block(view.unreleased, `${c.unreleased} · ${c.unreleasedNote}`) : null}
      {view?.current ? (
        block(view.current, `${c.version(view.current.version)}${dateOf(view.current)}`)
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
