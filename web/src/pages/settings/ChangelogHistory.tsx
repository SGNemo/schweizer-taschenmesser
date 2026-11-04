/** Settings → Updates: the changes of the latest versions, newest first, all open (scroll instead of click). */
import { useEffect, useRef, useState } from 'react';
import { loadChangelog } from '@/core/changelog/load';
import { newToken, selectChangelog } from '@/core/changelog/select';
import { markSeen } from '@/core/changelog/seen';
import type { ChangelogData, ChangelogVersion } from '@/core/changelog/types';
import { dateTimeFormat } from '@/core/i18n/format';
import { useLang } from '@/core/i18n/lang';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import styles from './settings.module.css';
import { VersionNotes } from './VersionNotes';

const CHANGELOG_URL = 'https://github.com/SGNemo/schweizer-taschenmesser/blob/main/CHANGELOG.md';

export function ChangelogHistory({ version }: { version: string }) {
  const lang = useLang();
  const [data, setData] = useState<ChangelogData | undefined>();
  useEffect(() => {
    void loadChangelog().then(setData);
  }, []);
  const view = data && version ? selectChangelog(data, version) : undefined;
  const token = view ? newToken(view) : undefined;
  // Having had this list on screen counts as having seen the newest notes (like the list in "Über Nemo").
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
  if (!data || !view) return null;

  const c = t.about.changes;
  const date = (v: ChangelogVersion) =>
    v.date
      ? ` · ${dateTimeFormat({ dateStyle: 'medium' }).format(new Date(`${v.date}T00:00:00`))}`
      : '';
  const versions: { v: ChangelogVersion; title: string }[] = [
    ...(view.unreleased ? [{ v: view.unreleased, title: c.unreleased }] : []),
    ...(view.current
      ? [{ v: view.current, title: `${c.version(view.current.version)}${date(view.current)}` }]
      : []),
    ...view.older.map((v) => ({ v, title: `${c.version(v.version)}${date(v)}` })),
  ];
  if (versions.length === 0) return null;

  return (
    <section className={styles.history} aria-label={c.history} data-testid="changelog-history">
      <h3 className={styles.historyTitle}>{c.history}</h3>
      {versions.map(({ v, title }) => (
        <Card key={v.version} title={title} data-testid={`history-${v.version}`}>
          <VersionNotes version={v} data={data} lang={lang} />
        </Card>
      ))}
      <div className={styles.row}>
        <Button onClick={() => void getPlatform().app.openUrl(CHANGELOG_URL)}>
          {t.about.links.changelog}
        </Button>
      </div>
    </section>
  );
}
