/** Settings → Updates: the changes of the latest versions, newest first, all open (scroll instead of click). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadChangelog } from '@/core/changelog/load';
import { devBuildNumber, newToken, selectChangelog } from '@/core/changelog/select';
import { markSeen } from '@/core/changelog/seen';
import type { ChangelogData, ChangelogEntry, ChangelogVersion } from '@/core/changelog/types';
import { dateTimeFormat } from '@/core/i18n/format';
import { useLang } from '@/core/i18n/lang';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Badge, Button, Card } from '@/ui';
import styles from './settings.module.css';
import { VersionNotes } from './VersionNotes';

/** Builds shown at first and per "show older builds" (a preview has hundreds of build numbers). */
const PAGE = 30;
const CHANGELOG_URL = 'https://github.com/SGNemo/schweizer-taschenmesser/blob/main/CHANGELOG.md';

export function ChangelogHistory({ version }: { version: string }) {
  const lang = useLang();
  const [data, setData] = useState<ChangelogData | undefined>();
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    let alive = true;
    void loadChangelog().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
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
  const installed = devBuildNumber(version);
  // The open notes of a preview: one row per build number that exists (newest first), a card where the build
  // has notes, one quiet line where it has none; notes without a known build (local) last.
  const byBuild = new Map<number | undefined, ChangelogEntry[]>();
  for (const e of view.unreleased?.entries ?? [])
    byBuild.set(e.build, [...(byBuild.get(e.build) ?? []), e]);
  const numbers = [
    ...new Set([
      ...(view.unreleased?.builds ?? []),
      ...[...byBuild.keys()].filter((b): b is number => !!b),
    ]),
  ].sort((a, b) => b - a);
  const rows: { build: number | undefined; entries: ChangelogEntry[] }[] = [
    ...numbers.map((build) => ({ build, entries: byBuild.get(build) ?? [] })),
    ...(byBuild.has(undefined) ? [{ build: undefined, entries: byBuild.get(undefined)! }] : []),
  ];
  const shownRows = rows.slice(0, limit);
  const buildTitle = (build: number | undefined) => (
    <>
      {build ? c.build(build) : c.unreleased}{' '}
      {build && build === installed ? <Badge>{c.installed}</Badge> : null}
    </>
  );
  const released: { v: ChangelogVersion; title: ReactNode }[] = [
    ...(view.current
      ? [{ v: view.current, title: `${c.version(view.current.version)}${date(view.current)}` }]
      : []),
    ...view.older.map((v) => ({ v, title: `${c.version(v.version)}${date(v)}` })),
  ];
  if (rows.length === 0 && released.length === 0) return null;
  const rest = rows.length - shownRows.length;

  return (
    <section className={styles.history} aria-label={c.history} data-testid="changelog-history">
      <h3 className={styles.historyTitle}>{c.history}</h3>
      {shownRows.map((r) =>
        r.entries.length > 0 ? (
          <Card
            key={r.build ?? 'unreleased'}
            title={buildTitle(r.build)}
            data-testid={`history-${r.build ? `build-${r.build}` : 'unreleased'}`}
          >
            <VersionNotes
              version={{
                version: r.build ? `build-${r.build}` : 'unreleased',
                date: '',
                entries: r.entries,
              }}
              data={data}
              lang={lang}
            />
          </Card>
        ) : (
          <p key={r.build} className={styles.emptyBuild} data-testid={`history-empty-${r.build}`}>
            {buildTitle(r.build)} <span className={styles.muted}>· {c.noChanges}</span>
          </p>
        ),
      )}
      {rest > 0 ? (
        <div className={styles.row}>
          <Button onClick={() => setLimit((n) => n + PAGE)}>
            {c.showMore} ({rest})
          </Button>
        </div>
      ) : null}
      {released.map(({ v, title }) => (
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
