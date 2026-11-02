import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { t } from '@/strings';
import { loadLinks } from '../links';
import { linkRepo } from '../repo';
import styles from './mail.module.css';

/** The way back: what was created from this thread, each linking to its module. */
export function LinkedEntries({ accountKey, threadId }: { accountKey: string; threadId: string }) {
  const links = useLiveQuery(() => loadLinks(accountKey, threadId), [accountKey, threadId]);
  const dead = (links ?? []).filter((l) => l.dead).map((l) => l.id);

  // Entries that were deleted since: forget the link (outside the live query, which may only read).
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
