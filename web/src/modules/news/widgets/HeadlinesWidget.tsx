import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { t } from '@/strings';
import { articleRepo, feedRepo } from '../repo';

export default function HeadlinesWidget() {
  const data = useLiveQuery(async () => {
    const feeds = new Map(
      (await feedRepo.active().toArray()).filter((f) => f.active).map((f) => [f.id, f]),
    );
    const unread = (await articleRepo.active().toArray())
      .filter((a) => !a.read && feeds.has(a.feedId))
      .sort((a, b) => b.publishedAt - a.publishedAt);
    return { feeds: feeds.size, unread };
  }, []);
  if (!data) return <p role="status">…</p>;
  if (data.feeds === 0) return <p style={{ color: 'var(--text-muted)' }}>{t.news.widgetNone}</p>;
  if (data.unread.length === 0)
    return <p style={{ color: 'var(--text-muted)' }}>{t.news.widgetEmpty}</p>;
  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-2)' }}>
        {data.unread.slice(0, 5).map((a) => (
          <li key={a.id} style={{ overflowWrap: 'anywhere', marginBottom: 'var(--space-1)' }}>
            {a.title}
          </li>
        ))}
      </ul>
      <Link to="/news">{t.news.widgetOpen}</Link>
    </div>
  );
}
