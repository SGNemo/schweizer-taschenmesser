import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { sortThreads } from '../logic';
import { threadRepo } from '../repo';

/** Home widget: the latest chats (titles only – never message text). */
export default function RecentChatsWidget() {
  const threads = useLiveQuery(
    async () => sortThreads((await threadRepo.active().toArray()).filter((x) => !x.archived)),
    [],
  );
  return (
    <WidgetList
      loading={!threads}
      empty={t.chat.widget.empty}
      emptyAction={{ label: t.homeEmpty.chat, to: '/chat?new=1' }}
      entries={(threads ?? []).slice(0, 4).map((x) => ({ key: x.id, title: x.title }))}
      to="/chat"
      linkLabel={t.chat.widget.link}
    />
  );
}
