import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, EmptyState, Skeleton } from '@/ui';
import { groupLinks } from '../logic';
import { linkRepo } from '../repo';

/** The first few links as buttons: one tap opens the service. */
export default function LinksWidget() {
  const links = useLiveQuery(
    async () => groupLinks(await linkRepo.active().toArray()).flatMap((g) => g.items),
    [],
  );
  if (!links) return <Skeleton width="60%" height="1.25rem" />;
  if (links.length === 0)
    return (
      <EmptyState compact title={t.launcher.widgetEmpty}>
        <Link to="/launcher?new=1">{t.homeEmpty.launcher}</Link>
      </EmptyState>
    );
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
