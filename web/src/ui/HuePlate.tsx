import type { ModuleHue } from '@/core/modules/types';
import { Icon, type IconName } from './icons';
import styles from './HuePlate.module.css';

/**
 * The icon plate of a module or tool in its identity colour: the hue fills it, the surface colour draws the icon.
 * One look for every list and card (library, settings, head); in "Ruhig" the hue is grey. Decoration: the name
 * always sits next to it.
 */
export function HuePlate({
  hue,
  icon,
  size = 'md',
}: {
  hue: ModuleHue;
  icon: IconName;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={styles.plate} data-hue={hue} data-size={size} aria-hidden="true">
      <Icon name={icon} size={size === 'lg' ? 26 : size === 'sm' ? 16 : 20} />
    </span>
  );
}
