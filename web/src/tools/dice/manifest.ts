import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dice',
  name: t.tools.dice.name,
  icon: 'dice',
  description: t.tools.dice.description,
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 130,
  component: () => import('./Tool'),
};
export default tool;
