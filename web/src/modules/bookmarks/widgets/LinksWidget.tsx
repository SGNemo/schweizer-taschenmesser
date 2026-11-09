import { useLiveQuery } from 'dexie-react-hooks';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { TileGrid } from '@/ui';
import { groupLinks } from '../logic';
import { itemRepo } from '../repo';
import styles from './LinksWidget.module.css';

/** Lesezeichen as quick-launch tiles (one tap opens the address) and one context line: how many, in how many groups. */
export default function LinksWidget() {
  const data = useLiveQuery(async () => {
    const items = (await itemRepo.active().toArray()).filter((i) => i.kind === 'link' && i.url);
    const groups = groupLinks(items);
    return {
      links: groups.flatMap(([, group]) => group),
      groups: groups.filter(([g]) => g).length,
    };
  }, []);
  const links = data?.links;
  return (
    <>
      <div className={styles.tiles}>
        <TileGrid
          loading={!links}
          empty={t.bookmarks.linksWidgetEmpty}
          emptyAction={{ label: t.bookmarks.addLink, to: '/bookmarks?view=links' }}
          entries={(links ?? []).map((l) => ({
            key: l.id,
            label: l.title,
            onOpen: () => void getPlatform().app.openUrl(l.url!),
          }))}
        />
      </div>
      {links && links.length > 0 ? (
        <p className={styles.context}>{t.bookmarks.linksContext(links.length, data.groups)}</p>
      ) : null}
    </>
  );
}
