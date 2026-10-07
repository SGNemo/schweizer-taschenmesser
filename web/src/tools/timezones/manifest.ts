import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'timezones',
  get name() {
    return t.tools.timezones.name;
  },
  icon: 'globe',
  get description() {
    return t.tools.timezones.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 125,
  component: () => import('./Tool'),
};
export default tool;
