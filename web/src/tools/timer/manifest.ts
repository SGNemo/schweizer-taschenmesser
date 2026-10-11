import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'timer',
  get name() {
    return t.tools.timer.name;
  },
  icon: 'timer',
  get description() {
    return t.tools.timer.description;
  },
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 40,
  component: () => import('./Tool'),
};
export default tool;
