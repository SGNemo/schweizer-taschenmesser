import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { displayTitle, sortNotes } from '../logic';
import { noteRepo } from '../repo';

export default function RecentNotesWidget() {
  const notes = useLiveQuery(async () => sortNotes(await noteRepo.active().toArray()), []);
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.notes, to: '/notes?new=1' }}
      loading={!notes}
      empty={t.notes.widgetEmpty}
      entries={(notes ?? []).slice(0, 4).map((n) => ({ key: n.id, title: displayTitle(n) }))}
      to="/notes"
      linkLabel={t.notes.title}
    />
  );
}
