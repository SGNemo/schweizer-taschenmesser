import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'hash',
  name: t.tools.hash.name,
  icon: 'hash',
  description: t.tools.hash.description,
  group: 'dev',
  offline: true,
  defaultEnabled: false,
  order: 230,
  component: () => import('./Tool'),
};
export default tool;
