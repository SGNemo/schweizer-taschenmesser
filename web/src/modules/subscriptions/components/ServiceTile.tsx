import { MODULE_HUES } from '@/core/modules/types';
import { monogram, paletteIndex } from '../logic';
import styles from '../routes/subscriptions.module.css';

/**
 * A service as a tile: its monogram on a tint of one of the ten module hues, the hue picked from
 * the name so it stays the same everywhere. No logos of third parties; the name always stands next
 * to it as text, so the tile itself is decoration.
 */
export function ServiceTile({ name }: { name: string }) {
  const hue = MODULE_HUES[paletteIndex(name, MODULE_HUES.length)]!;
  return (
    <span className={styles.tile} data-hue={hue} aria-hidden="true">
      {monogram(name)}
    </span>
  );
}
