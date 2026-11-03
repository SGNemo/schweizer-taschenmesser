import { Fragment } from 'react';
import { Link } from 'react-router';
import { tSettings2 } from '@/strings.settings2';
import { Icon } from '@/ui';
import styles from './SettingsLayout.module.css';

export interface Crumb {
  label: string;
  /** Last crumb (the current place) has none. */
  to?: string;
}

/** `Einstellungen › Kategorie › Abschnitt`: where the content is, each step but the last a link. */
export function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  const n = tSettings2.use().nav;
  return (
    <nav aria-label={n.breadcrumb} className={styles.breadcrumb} data-testid="settings-breadcrumb">
      <ol>
        {items.map((c, i) => (
          <Fragment key={`${i}:${c.label}`}>
            <li>
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </li>
            {i < items.length - 1 ? (
              <li aria-hidden="true" className={styles.crumbSep}>
                <Icon name="chevronRight" size={14} />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
