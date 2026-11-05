import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { t } from '@/strings';
import { TileGrid } from '@/ui';
import { bookmarkRepo } from '../repo';
import styles from './BookmarksWidget.module.css';

/** Saved pages as quick-launch tiles (a tap opens the page in the Nemo browser) and one context line. */
export default function BookmarksWidget() {
  const navigate = useNavigate();
  const all = useLiveQuery(() => bookmarkRepo.active().toArray(), []);
  const marks = all?.slice(0, 8);
  return (
    <>
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
      {all && all.length > 0 ? (
        <p className={styles.context}>{t.browser.meta.widgetContext(all.length)}</p>
      ) : null}
    </>
  );
}
