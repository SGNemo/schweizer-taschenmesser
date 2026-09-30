import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'timer',
  name: t.tools.timer.name,
  icon: 'timer',
  description: t.tools.timer.description,
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 40,
  component: () => import('./Tool'),
};
export default tool;
