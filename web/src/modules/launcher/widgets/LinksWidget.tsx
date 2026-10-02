import { useLiveQuery } from 'dexie-react-hooks';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { TileGrid } from '@/ui';
import { groupLinks } from '../logic';
import { linkRepo } from '../repo';

/** Quick-launch tiles: one tap opens the service. */
export default function LinksWidget() {
  const links = useLiveQuery(
    async () => groupLinks(await linkRepo.active().toArray()).flatMap((g) => g.items),
    [],
  );
  return (
    <TileGrid
      loading={!links}
      empty={t.launcher.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.launcher, to: '/launcher?new=1' }}
      entries={(links ?? []).map((l) => ({
        key: l.id,
        label: l.title,
        onOpen: () => void getPlatform().app.openUrl(l.url),
      }))}
    />
  );
}
