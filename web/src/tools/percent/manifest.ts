import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'percent',
  name: t.tools.percent.name,
  icon: 'percent',
  description: t.tools.percent.description,
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 20,
  component: () => import('./Tool'),
};
export default tool;
