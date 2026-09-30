import { useLiveQuery } from 'dexie-react-hooks';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import { groupLinks } from '../logic';
import { linkRepo } from '../repo';

/** The first few links as buttons: one tap opens the service. */
export default function LinksWidget() {
  const links = useLiveQuery(
    async () => groupLinks(await linkRepo.active().toArray()).flatMap((g) => g.items),
    [],
  );
  if (!links) return <p role="status">…</p>;
  if (links.length === 0) return <p>{t.launcher.widgetEmpty}</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      {links.slice(0, 6).map((l) => (
        <Button key={l.id} onClick={() => void getPlatform().app.openUrl(l.url)}>
          {l.title}
        </Button>
      ))}
    </div>
  );
}
