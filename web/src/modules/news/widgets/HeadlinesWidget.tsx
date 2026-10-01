import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
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
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.news, to: '/news' }}
      loading={!data}
      empty={data && data.feeds === 0 ? t.news.widgetNone : t.news.widgetEmpty}
      entries={(data?.unread ?? []).slice(0, 5).map((a) => ({ key: a.id, title: a.title }))}
      to="/news"
      linkLabel={t.news.widgetOpen}
    />
  );
}
