import { useLiveQuery } from 'dexie-react-hooks';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { TileGrid } from '@/ui';
import { groupLinks } from '../logic';
import { itemRepo } from '../repo';

/** Lesezeichen as quick-launch tiles: one tap opens the address. */
export default function LinksWidget() {
  const links = useLiveQuery(async () => {
    const items = (await itemRepo.active().toArray()).filter((i) => i.kind === 'link' && i.url);
    return groupLinks(items).flatMap(([, group]) => group);
  }, []);
  return (
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
  );
}
