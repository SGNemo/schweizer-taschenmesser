import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { t } from '@/strings';
import { TileGrid } from '@/ui';
import { bookmarkRepo } from '../repo';

/** Saved pages as quick-launch tiles; a tap opens the page in the Nemo browser. */
export default function BookmarksWidget() {
  const navigate = useNavigate();
  const marks = useLiveQuery(async () => (await bookmarkRepo.active().toArray()).slice(0, 8), []);
  return (
    <TileGrid
      loading={!marks}
      empty={t.browser.meta.widgetEmpty}
      emptyAction={{ label: t.browser.meta.widgetAction, to: '/browser' }}
      entries={(marks ?? []).map((m) => ({
        key: m.id,
        label: m.title,
        onOpen: () => void navigate(`/browser?url=${encodeURIComponent(m.url)}`),
      }))}
    />
  );
}
