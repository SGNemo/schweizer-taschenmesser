import { useState } from 'react';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Card, SettingsGroup } from '@/ui';
import { GameModeCard } from './GameModeCard';
import { PushSection } from './PushSection';
import styles from './settings.module.css';

function introText(): string {
  const platform = getPlatform();
  if (platform.kind === 'android') return t.notifications.introAndroid;
  return platform.isNative ? t.notifications.introDesktop : t.notifications.intro;
}

function NotificationsCard() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getPlatform().notifications.permission(),
  );
  return (
    <Card>
      <div className={styles.form}>
        <p>{introText()}</p>
        <p role="status" data-testid="notification-status">
          {t.notifications[permission]}
        </p>
        {permission === 'default' ? (
          <Button
            variant="primary"
            onClick={async () =>
              setPermission(await getPlatform().notifications.requestPermission())
            }
          >
            {t.notifications.enable}
          </Button>
        ) : null}
        {permission === 'granted' ? (
          <Button
            onClick={() =>
              void getPlatform().notifications.show({
                title: t.appName,
                body: t.notifications.testBody,
                tag: 'test',
              })
            }
          >
            {t.notifications.test}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function NotificationsSection() {
  return (
    <SettingsGroup id="notifications" title={t.notifications.title} bare>
      <NotificationsCard />
      <GameModeCard />
      {getPlatform().isNative ? null : <PushSection />}
    </SettingsGroup>
  );
}
