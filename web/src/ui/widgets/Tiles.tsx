import type { ReactNode } from 'react';
import { useWidgetSize, rowsFor } from './size';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface TileEntry {
  key: string;
  label: string;
  onOpen: () => void;
  icon?: ReactNode;
}

/** Quick-launch tiles (≥ 44 px touch targets), wrapping. 4 / 6 / 9 tiles. */
export function TileGrid({
  loading,
  entries,
  ...emptyProps
}: WidgetEmpty & { loading: boolean; entries: TileEntry[] }) {
  const size = useWidgetSize();
  const shown = entries.slice(0, rowsFor(size, [4, 6, 9]));
  return (
    <WidgetBody loading={loading} isEmpty={entries.length === 0} {...emptyProps}>
      <ul className={styles.tiles}>
        {shown.map((e) => (
          <li key={e.key} className={styles.tileItem}>
            <button type="button" className={styles.tile} onClick={e.onOpen} title={e.label}>
              {e.icon}
              <span className={styles.tileLabel}>{e.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </WidgetBody>
  );
}
