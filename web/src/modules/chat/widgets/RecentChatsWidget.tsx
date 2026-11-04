import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { t } from '@/strings';
import { WidgetBody } from '@/ui';
import { sortThreads } from '../logic';
import { threadRepo } from '../repo';
import styles from './RecentChatsWidget.module.css';

/** Widget variant `notiz`: the latest chat as a speech bubble, two more titles underneath (titles only, never message text). */
export default function RecentChatsWidget() {
  const threads = useLiveQuery(
    async () => sortThreads((await threadRepo.active().toArray()).filter((x) => !x.archived)),
    [],
  );
  const [first, ...rest] = threads ?? [];
  return (
    <WidgetBody
      loading={!threads}
      isEmpty={!first}
      empty={t.chat.widget.empty}
      emptyAction={{ label: t.homeEmpty.chat, to: '/chat?new=1' }}
    >
      {first ? (
        <Link to={`/chat?t=${first.id}`} className={styles.bubble}>
          {first.title}
        </Link>
      ) : null}
      <ul className={styles.list}>
        {rest.slice(0, 2).map((x) => (
          <li key={x.id}>{x.title}</li>
        ))}
      </ul>
    </WidgetBody>
  );
}
