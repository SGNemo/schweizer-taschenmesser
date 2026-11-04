import type { CSSProperties, ReactNode } from 'react';
import styles from './FolderTabs.module.css';

export interface FolderTab {
  id: string;
  label: string;
  /** Shown next to the label (hidden when 0 or missing); put counts into `label` when 0 must show. */
  count?: number;
  /** A small mark in front of the label (an icon). */
  icon?: ReactNode;
  /** The tab's own colour (a CSS colour, e.g. `categoryColor(tone)`): its fill. Without one the module hue tints the tab. */
  color?: string;
}

/**
 * Folder tabs: a row of tab-shaped buttons that stick out of the surface below, the chosen one filled. It is a filter
 * (a group of buttons with `aria-pressed`, named after their labels), not a page switcher. The fill, the shape and the
 * weight carry the state, colour is never alone. `folder` adds the folder body under the tabs (a hairline bar the chosen
 * tab merges into); `children` are extra controls at the end of the row (an add button).
 */
export function FolderTabs({
  label,
  tabs,
  value,
  onChange,
  folder,
  testId,
  children,
}: {
  label: string;
  tabs: readonly FolderTab[];
  value: string;
  onChange: (id: string) => void;
  folder?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={folder ? `${styles.root} ${styles.folder}` : styles.root}
      role="group"
      aria-label={label}
      data-testid={testId}
    >
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={styles.tab}
            data-tinted={tab.color ? '' : undefined}
            style={tab.color ? ({ '--tab': tab.color } as CSSProperties) : undefined}
            aria-pressed={value === tab.id}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count ? <span className={styles.num}>{tab.count}</span> : null}
          </button>
        ))}
        {children}
      </div>
      {folder ? <div className={styles.body} aria-hidden="true" /> : null}
    </div>
  );
}
