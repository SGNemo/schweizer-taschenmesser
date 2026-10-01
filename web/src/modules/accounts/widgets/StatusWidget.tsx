import { Link } from 'react-router';
import { t } from '@/strings';
import { Badge, Skeleton } from '@/ui';
import { useHeaderState } from '../hooks';
import { useSession } from '../session';

/**
 * Home-screen status of the vault: locked / unlocked and a link. **Never shows entries**
 * (no entry data is read here; `__tests__/exclusion.test.ts` checks the source).
 */
export default function StatusWidget() {
  const header = useHeaderState();
  const unlocked = useSession((s) => s.session.status === 'unlocked');
  const w = t.accountsWidget;
  if (!header) return <Skeleton width="60%" height="1.25rem" />;
  if (header.state === 'none')
    return (
      <div>
        <p>{w.notSetUp}</p>
        <Link to="/accounts">{w.setUp}</Link>
      </div>
    );
  return (
    <div>
      <p>
        <Badge>{unlocked ? w.unlocked : w.locked}</Badge>
      </p>
      <p>{w.hint}</p>
      <Link to="/accounts">{unlocked ? w.open : w.unlock}</Link>
    </div>
  );
}
