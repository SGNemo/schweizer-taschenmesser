import type { ToolManifest } from '@/core/tools/types';
import { Icon } from '@/ui';
import styles from './ToolPlate.module.css';

/** The icon of a tool on a plate in its hue (`identity.hue`): tile, head, library card. Decoration, the name sits next to it. */
export function ToolPlate({
  tool,
  size = 'md',
}: {
  tool: ToolManifest;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={styles.plate} data-hue={tool.identity.hue} data-size={size} aria-hidden="true">
      <Icon name={tool.icon} size={size === 'lg' ? 26 : size === 'sm' ? 16 : 20} />
    </span>
  );
}
