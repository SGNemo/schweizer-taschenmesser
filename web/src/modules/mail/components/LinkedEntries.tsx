import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { t } from '@/strings';
import { loadLinks } from '../links';
import { linkRepo } from '../repo';
import styles from './mail.module.css';

/**
 * The way back: what was created from this thread, each linking to the entry itself (`?open=<id>`). Read from
 * this device's link rows and the synced link table, so it is the same list on every desktop.
 */
export function LinkedEntries({ accountKey, threadId }: { accountKey: string; threadId: string }) {
  const links = useLiveQuery(() => loadLinks(accountKey, threadId), [accountKey, threadId]);
  const dead = (links ?? []).flatMap((l) => (l.dead && l.localId ? [l.localId] : []));

  // Entries that were deleted since: forget this device's link row (outside the live query, which may only
  // read). A synced link is never removed here: its carrier is gone, and the sweep of its tombstone takes it.
  useEffect(() => {
    if (dead.length > 0) void linkRepo.purge(dead);
  }, [dead.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (links ?? []).filter((l) => !l.dead);
  if (shown.length === 0) return null;
  return (
    <section aria-label={t.mail.link.created} data-testid="mail-linked">
      <p className={styles.meta}>{t.mail.link.created}</p>
      <ul className={styles.attachments}>
        {shown.map((l) => {
          const what = t.quickCapture.type[l.type];
          return (
            <li key={l.id}>
              {l.to ? (
                <Link to={l.to} aria-label={t.mail.link.open(what, l.title)}>
                  {what}: {l.title}
                </Link>
              ) : (
                <span>
                  {what}: {l.title}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
