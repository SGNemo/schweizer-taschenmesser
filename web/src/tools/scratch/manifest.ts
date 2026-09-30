import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'scratch',
  name: t.tools.scratch.name,
  icon: 'note',
  description: t.tools.scratch.description,
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 60,
  component: () => import('./Tool'),
};
export default tool;
