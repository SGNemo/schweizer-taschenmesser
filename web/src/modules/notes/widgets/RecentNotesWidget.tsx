import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { displayTitle, excerpt, isScratch, sortNotes } from '../logic';
import { noteRepo } from '../repo';

/** The scratch pad at a glance (headline), the pages changed last (list), and "new page" when empty. */
export default function RecentNotesWidget() {
  const notes = useLiveQuery(async () => sortNotes(await noteRepo.active().toArray()), []);
  const scratch = notes?.find(isScratch);
  const scratchText = scratch ? excerpt({ title: t.notes.scratch, body: scratch.body }, 90) : '';
  const recent = (notes ?? [])
    .filter((n) => !isScratch(n))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.notes, to: '/notes?new=1' }}
      loading={!notes}
      empty={scratchText ? undefined : t.notes.widgetEmpty}
      headline={scratchText ? t.notes.scratch : undefined}
      subline={scratchText || undefined}
      entries={recent.slice(0, 3).map((n) => ({ key: n.id, title: displayTitle(n) }))}
      to="/notes"
      linkLabel={t.notes.title}
    />
  );
}
