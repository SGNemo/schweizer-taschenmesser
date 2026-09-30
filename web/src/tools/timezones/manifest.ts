import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'timezones',
  name: t.tools.timezones.name,
  icon: 'globe',
  description: t.tools.timezones.description,
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 125,
  component: () => import('./Tool'),
};
export default tool;
