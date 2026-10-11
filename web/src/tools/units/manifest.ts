import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'units',
  get name() {
    return t.tools.units.name;
  },
  icon: 'ruler',
  get description() {
    return t.tools.units.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 100,
  component: () => import('./Tool'),
};
export default tool;
