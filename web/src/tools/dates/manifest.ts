import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dates',
  get name() {
    return t.tools.dates.name;
  },
  icon: 'calendarDays',
  get description() {
    return t.tools.dates.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 120,
  component: () => import('./Tool'),
};
export default tool;
