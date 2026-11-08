import { useState } from 'react';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Card, SettingsGroup } from '@/ui';
import { StateBanner } from './ConnectParts';
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
        <StateBanner
          tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'attention' : 'neutral'}
          title={t.notifications[permission]}
          line={introText()}
          titleTestId="notification-status"
          // Settings identity v3.1: the state and its one action in one card.
          action={
            permission === 'default' ? (
              <Button
                variant="primary"
                onClick={async () =>
                  setPermission(await getPlatform().notifications.requestPermission())
                }
              >
                {t.notifications.enable}
              </Button>
            ) : permission === 'granted' ? (
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
            ) : undefined
          }
        />
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
