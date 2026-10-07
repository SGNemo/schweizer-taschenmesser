import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import type { ModuleManifest, WidgetDef } from '@/core/modules/types';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './Home.module.css';

/** Key of the generated widget: `<moduleId>:auto`. */
export const AUTO_WIDGET_ID = 'auto';

/**
 * Number of live entries in the module's synced collections, or `undefined` while loading / when
 * the module has no countable data (no collections, or the data API blocks them).
 */
export function countableCollections(m: ModuleManifest): string[] {
  if (m.dataApi === false) return [];
  return Object.entries(m.dataSchema.collections)
    .filter(([, c]) => !c.local && c.dataApi !== false)
    .map(([name]) => tableName(m.id, name));
}

/** A module without a widget of its own still shows up: icon, name, description, count, link. */
export function AutoWidgetBody({ manifest }: { manifest: ModuleManifest }) {
  const tables = countableCollections(manifest);
  const count = useLiveQuery(async () => {
    if (tables.length === 0) return null;
    const counts = await Promise.all(
      tables.map((n) =>
        db
          .table(n)
          .filter((r: { deletedAt?: unknown }) => !r.deletedAt)
          .count(),
      ),
    );
    return counts.reduce((a, b) => a + b, 0);
  }, [tables.join()]);
  const route = manifest.routes.find((r) => r.nav) ?? manifest.routes[0];
  return (
    <div className={styles.auto}>
      <p>
        <Icon name={manifest.icon} size={20} /> {manifest.description}
      </p>
      {typeof count === 'number' ? <p>{t.homeAuto.entries(count)}</p> : null}
      {route ? <Link to={route.path}>{t.homeAuto.open(manifest.name)}</Link> : null}
    </div>
  );
}

/** The `WidgetDef` the home screen generates for a module that offers none. */
export function autoWidgetDef(manifest: ModuleManifest): WidgetDef {
  return {
    id: AUTO_WIDGET_ID,
    title: manifest.name,
    defaultSize: 's',
    sizes: ['s', 'm', 'l'],
    component: async () => ({ default: () => <AutoWidgetBody manifest={manifest} /> }),
  };
}

/** The widgets a module shows: its own, or the generated fallback when it declares none. */
export function widgetsOf(manifest: ModuleManifest): WidgetDef[] {
  return manifest.widgets.length > 0 ? manifest.widgets : [autoWidgetDef(manifest)];
}
