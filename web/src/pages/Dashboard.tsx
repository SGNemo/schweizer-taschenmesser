import { Suspense } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { lazyComponent } from '@/core/modules/lazy';
import { visibleManifests } from '@/core/modules/registry';
import { t } from '@/strings';
import { Card, EmptyState } from '@/ui';
import styles from './Page.module.css';

export function Dashboard() {
  const states = useModuleStates();
  const active = visibleManifests.filter((m) => states?.[m.id]);
  const widgets = active.flatMap((m) => m.widgets.map((w) => ({ moduleId: m.id, ...w })));

  return (
    <>
      <div className={styles.header}>
        <h1>{t.dashboard.title}</h1>
      </div>
      {states && active.length === 0 ? (
        <EmptyState icon="grid" title={t.dashboard.emptyTitle}>
          <p>{t.dashboard.emptyText}</p>
          <Link to="/library">{t.dashboard.toLibrary}</Link>
        </EmptyState>
      ) : widgets.length === 0 && states ? (
        <p className={styles.lead}>{t.dashboard.noWidgets}</p>
      ) : (
        <div className={styles.grid}>
          {widgets.map((w) => {
            const Widget = lazyComponent(w.component);
            return (
              <Card key={`${w.moduleId}:${w.id}`} title={w.title}>
                <Suspense fallback={<p role="status">…</p>}>
                  <Widget />
                </Suspense>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
