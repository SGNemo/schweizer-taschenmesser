import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'units',
  name: t.tools.units.name,
  icon: 'ruler',
  description: t.tools.units.description,
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 100,
  component: () => import('./Tool'),
};
export default tool;
