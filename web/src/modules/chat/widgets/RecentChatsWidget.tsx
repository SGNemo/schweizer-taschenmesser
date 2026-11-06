import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { relativeDays } from '@/core/i18n/format';
import { daysBetween, formatDay, toDateString, today } from '@/core/time/dates';
import { t } from '@/strings';
import { NotizBody, WidgetBody } from '@/ui';
import { sortThreads } from '../logic';
import { threadRepo } from '../repo';
import styles from './RecentChatsWidget.module.css';

/**
 * Widget variant `notiz` (`NotizBody`): the first chat of the list (pinned ones first, then the latest) as the title
 * with the bubble mark, two more titles underneath and one context line (how many, when last). Titles only, never
 * message text. The paper opens the first chat.
 */
export default function RecentChatsWidget() {
  const threads = useLiveQuery(
    async () => sortThreads((await threadRepo.active().toArray()).filter((x) => !x.archived)),
    [],
  );
  const [first, ...rest] = threads ?? [];
  const lastDay = toDateString(new Date(Math.max(0, ...(threads ?? []).map((x) => x.updatedAt))));
  const diff = daysBetween(today(), lastDay);
  // "heute" / "gestern" in the running sentence, an older day as a short date.
  const when = Math.abs(diff) <= 1 ? relativeDays(diff) : formatDay(lastDay, 'd. MMM');
  return (
    <WidgetBody
      loading={!threads}
      isEmpty={!first}
      empty={t.chat.widget.empty}
      emptyAction={{ label: t.homeEmpty.chat, to: '/chat?new=1' }}
    >
      {first ? (
        <Link to={`/chat?t=${first.id}`} className={styles.open}>
          <NotizBody
            title={first.title}
            lines={rest.map((x) => x.title)}
            meta={t.chat.widget.context(threads!.length, when)}
          />
        </Link>
      ) : null}
    </WidgetBody>
  );
}
