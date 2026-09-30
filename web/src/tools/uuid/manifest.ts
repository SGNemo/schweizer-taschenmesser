import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'uuid',
  name: t.tools.uuid.name,
  icon: 'hash',
  description: t.tools.uuid.description,
  group: 'dev',
  offline: true,
  defaultEnabled: false,
  order: 220,
  component: () => import('./Tool'),
};
export default tool;
