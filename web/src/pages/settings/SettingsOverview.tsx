import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { formatMuteEnd, useMute } from '@/core/notifications/mute';
import { getPlatform } from '@/core/platform';
import { useFocusSettings } from '@/core/settings/focus';
import { categoryDef } from '@/core/settings/registry/categories';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
import { useUiStore } from '@/stores/ui';
import { tSettings2 } from '@/strings.settings2';
import { Icon, type IconName } from '@/ui';
import styles from './SettingsOverview.module.css';

interface CardProps {
  to: string;
  icon: IconName;
  title: string;
  /** The state in one line. */
  status: string;
  /** What the number means / what else is there, in one calm line. */
  context?: string;
  testId: string;
  /** `true` = something needs a look (a plain marker, never red). */
  attention?: boolean;
}

function OverviewCard({ to, icon, title, status, context, testId, attention }: CardProps) {
  return (
    <li>
      <Link to={to} className={styles.card} data-testid={testId} data-attention={attention}>
        <span className={styles.head}>
          <span className={styles.icon}>
            <Icon name={icon} />
          </span>
          <span className={styles.title}>{title}</span>
        </span>
        <span className={styles.status}>{status}</span>
        {context ? <span className={styles.context}>{context}</span> : null}
      </Link>
    </li>
  );
}

const cat = (id: SettingsCategoryId) => categoryDef(id).title;

function LookCard() {
  const o = tSettings2.use().overview.look;
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  return (
    <OverviewCard
      testId="overview-look"
      to="/settings/darstellung"
      icon="sun"
      title={cat('darstellung')}
      status={`${o.theme[theme]} · ${o.density[density]}`}
      context={o.context}
    />
  );
}

function NotificationsCard() {
  const o = tSettings2.use().overview.notifications;
  const [focus] = useFocusSettings();
  const mute = useMute();
  const allowed = getPlatform().notifications.permission() === 'granted';
  const quiet = focus.quietHours ? o.quiet(focus.quietFrom, focus.quietTo) : o.quietOff;
  return (
    <OverviewCard
      testId="overview-notifications"
      to="/settings/benachrichtigungen"
      icon="bell"
      title={cat('benachrichtigungen')}
      status={allowed ? o.allowed : o.notAllowed}
      context={mute ? o.muted(formatMuteEnd(mute.until)) : quiet}
    />
  );
}

function ModulesCard() {
  const o = tSettings2.use().overview.modules;
  const states = useModuleStates();
  const total = availableManifests().length;
  const active = states ? Object.values(states).filter(Boolean).length : 0;
  return (
    <OverviewCard
      testId="overview-modules"
      to="/settings/module"
      icon="grid"
      title={cat('module')}
      status={o.active(active, total)}
      context={o.context}
    />
  );
}

/** `/settings` under the status head: the categories whose state is not one of its six tiles, as cards. */
export function SettingsOverview() {
  const o = tSettings2.use().overview;
  return (
    <section aria-label={o.title} data-testid="settings-overview">
      <ul className={styles.grid}>
        <LookCard />
        <NotificationsCard />
        <ModulesCard />
      </ul>
    </section>
  );
}
