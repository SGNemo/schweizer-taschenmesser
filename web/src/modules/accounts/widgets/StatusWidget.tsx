import { t } from '@/strings';
import { Skeleton, StatusWidget as StatusCard, WidgetBody } from '@/ui';
import { useHeaderState } from '../hooks';
import { useSession } from '../session';

/**
 * Home-screen status of the vault: locked / unlocked and one action. **Never shows entries**
 * (no entry data is read here; `__tests__/exclusion.test.ts` checks the source).
 */
export default function StatusWidget() {
  const header = useHeaderState();
  const unlocked = useSession((s) => s.session.status === 'unlocked');
  const w = t.accountsWidget;
  if (!header) return <Skeleton width="60%" height="1.25rem" />;
  // Not set up yet: the shared empty state (the fish) with one next step, like every other widget (C34).
  if (header.state === 'none')
    return (
      <WidgetBody
        loading={false}
        isEmpty
        empty={w.notSetUp}
        emptyAction={{ label: w.setUp, to: '/accounts' }}
      >
        {null}
      </WidgetBody>
    );
  return (
    <StatusCard
      icon={unlocked ? 'unlock' : 'lock'}
      state={unlocked ? w.unlocked : w.locked}
      tone={unlocked ? 'success' : 'neutral'}
      hint={w.hint}
      action={{ label: unlocked ? w.open : w.unlock, to: '/accounts' }}
    />
  );
}
