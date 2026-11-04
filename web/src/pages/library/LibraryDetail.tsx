import { Link, useParams } from 'react-router';
import { hasStartData } from '@/core/dataapi/onboarding';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tLibraryV3 } from '@/strings.libraryV3';
import { Badge, Card, EmptyState, Icon, Switch } from '@/ui';
import { STATUS_LOOK } from '../settings/categoryLook';
import { PageHead } from '../settings/PageHead';
import { useModuleSwitch } from './useModuleSwitch';
import { WidgetMiniature } from './WidgetMiniature';
import styles from './LibraryDetail.module.css';

/** Has the module a settings page of its own (`/settings/module/<id>`)? Same rule as the settings page. */
const hasSettingsPage = (m: ModuleManifest) =>
  (m.settings.category ?? 'module') === 'module' &&
  (m.settings.fields.length > 0 || hasStartData(m));

/**
 * `/library/<id>`: a mini version of the module (identity v3): its head in its own colours, the sketch of its
 * widget large, the facts that decide whether to switch it on, and the same switch as the card.
 */
export function LibraryDetail() {
  const { moduleId } = useParams();
  const states = useModuleStates();
  const sw = useModuleSwitch();
  const v3 = tLibraryV3.use();
  const manifest = availableManifests().find((m) => m.id === moduleId);

  if (!manifest) {
    return (
      <>
        <PageHead
          {...STATUS_LOOK}
          icon="grid"
          eyebrow={v3.eyebrow}
          title={t.library.title}
          testId="library-detail-missing"
        />
        <EmptyState compact title={v3.detail.notFound}>
          <Link to="/library">{v3.detail.back}</Link>
        </EmptyState>
      </>
    );
  }

  const m = manifest;
  const enabled = states?.[m.id] ?? false;
  const d = v3.detail;
  const platforms = m.platforms?.length
    ? m.platforms.map((p) => d.platformNames[p] ?? p).join(', ')
    : d.allPlatforms;
  return (
    <div data-testid="library-detail" data-module={m.id}>
      <Link to="/library" className={styles.back}>
        <Icon name="chevronLeft" />
        {d.back}
      </Link>
      <PageHead
        hue={m.identity.hue}
        hue2={m.identity.hue2}
        area={m.area ?? 'system'}
        icon={m.icon}
        eyebrow={v3.eyebrow}
        title={m.name}
        description={m.description}
        testId="library-detail-head"
      />
      <div className={styles.body}>
        <Card className={styles.preview} data-hue={m.identity.hue}>
          <WidgetMiniature variant={m.identity.widget} size="lg" />
          <p className={styles.caption}>{d.widget}</p>
        </Card>
        <Card className={styles.facts}>
          <dl>
            <div>
              <dt>{d.area}</dt>
              <dd>{m.area ? t.nav.areas[m.area] : t.library.other}</dd>
            </div>
            <div>
              <dt>{d.status}</dt>
              <dd>
                <Badge tone={enabled ? 'accent' : undefined}>
                  {enabled ? d.statusOn : d.statusOff}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>{d.maturity}</dt>
              <dd>{m.maturity === 'preview' ? d.preview : d.stable}</dd>
            </div>
            <div>
              <dt>{d.platforms}</dt>
              <dd>{platforms}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <Switch
              label={tComfort.get().library.toggle(m.name)}
              checked={enabled}
              disabled={!states}
              onChange={(on) => sw.set(m, on)}
            />
            {enabled && hasStartData(m) ? (
              <StartDataButton moduleId={m.id} setupLink={false} />
            ) : null}
            {enabled && hasSettingsPage(m) ? (
              <Link to={`/settings/module/${m.id}`} className={styles.link}>
                {d.settings}
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
      {sw.node}
    </div>
  );
}
