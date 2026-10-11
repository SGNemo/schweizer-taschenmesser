import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dice',
  get name() {
    return t.tools.dice.name;
  },
  icon: 'dice',
  get description() {
    return t.tools.dice.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 130,
  component: () => import('./Tool'),
};
export default tool;
