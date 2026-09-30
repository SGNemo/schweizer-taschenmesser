import { useEffect, useState } from 'react';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { getPlatform } from '@/core/platform';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Button, patternStyles } from '@/ui';

const s = t.setup.steps.notifications;

/**
 * Asks for the permission on an explicit click (browsers require a gesture anyway). Denying is
 * fine: the step is then recorded as skipped and stays in the checklist.
 */
export default function NotificationsStep({ registerCommit }: SetupStepProps) {
  const platform = getPlatform();
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    platform.notifications.permission(),
  );

  useEffect(() => {
    registerCommit(async () => (permission === 'granted' ? undefined : 'skipped'));
    return () => registerCommit(null);
  }, [registerCommit, permission]);

  return (
    <>
      <p className={patternStyles.muted}>{s.why}</p>
      <p role="status" data-testid="setup-notification-status">
        {s.state[permission]}
      </p>
      {permission === 'default' ? (
        <Button
          variant="primary"
          onClick={async () => setPermission(await platform.notifications.requestPermission())}
        >
          {s.allow}
        </Button>
      ) : null}
      {platform.kind === 'android' ? <p>{s.android}</p> : null}
    </>
  );
}
