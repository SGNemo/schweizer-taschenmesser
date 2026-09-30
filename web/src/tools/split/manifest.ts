import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'split',
  name: t.tools.split.name,
  icon: 'users',
  description: t.tools.split.description,
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 110,
  component: () => import('./Tool'),
};
export default tool;
