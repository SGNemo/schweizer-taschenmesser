import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { t } from '@/strings';
import { itemRepo } from '../repo';

export default function RecentWidget() {
  const open = useLiveQuery(
    async () =>
      (await itemRepo.active().toArray())
        .filter((i) => !i.done)
        .sort((a, b) => b.createdAt - a.createdAt),
    [],
  );
  if (!open) return <p role="status">…</p>;
  if (open.length === 0)
    return <p style={{ color: 'var(--text-muted)' }}>{t.bookmarks.widgetEmpty}</p>;
  return (
    <div>
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>{t.bookmarks.openCount(open.length)}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0' }}>
        {open.slice(0, 4).map((i) => (
          <li key={i.id} style={{ overflowWrap: 'anywhere' }}>
            {i.title}
          </li>
        ))}
      </ul>
      <Link to="/bookmarks">{t.bookmarks.title}</Link>
    </div>
  );
}
