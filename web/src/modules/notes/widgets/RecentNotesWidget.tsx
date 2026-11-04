import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { t } from '@/strings';
import { WidgetBody } from '@/ui';
import { displayTitle, excerpt, isScratch, sortNotes } from '../logic';
import { noteRepo } from '../repo';
import styles from './RecentNotesWidget.module.css';

/**
 * Widget variant `notiz`: the scratch pad as a little sheet (serif title, the first lines), the pages changed last
 * underneath as small print, and "new page" when empty.
 */
export default function RecentNotesWidget() {
  const notes = useLiveQuery(async () => sortNotes(await noteRepo.active().toArray()), []);
  const scratch = notes?.find(isScratch);
  const scratchText = scratch ? excerpt({ title: t.notes.scratch, body: scratch.body }, 120) : '';
  const recent = (notes ?? [])
    .filter((n) => !isScratch(n))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  return (
    <WidgetBody
      loading={!notes}
      isEmpty={!scratchText && recent.length === 0}
      empty={t.notes.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.notes, to: '/notes?new=1' }}
    >
      {scratchText ? (
        <Link to="/notes" className={styles.sheet}>
          <span className={styles.title}>{t.notes.scratch}</span>
          <span className={styles.text}>{scratchText}</span>
        </Link>
      ) : null}
      {recent.length > 0 ? (
        <ul className={styles.list}>
          {recent.map((n) => (
            <li key={n.id}>{displayTitle(n)}</li>
          ))}
        </ul>
      ) : null}
    </WidgetBody>
  );
}
