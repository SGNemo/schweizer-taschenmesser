import { useLiveQuery } from 'dexie-react-hooks';
import { entryRepo } from '../repo';

export default function SummaryWidget() {
  const open = useLiveQuery(
    () =>
      entryRepo
        .active()
        .filter((e) => !e.done)
        .count(),
    [],
  );
  return <p>{open === undefined ? '…' : `${open} offen`}</p>;
}
