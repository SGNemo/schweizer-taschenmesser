import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'base64',
  name: t.tools.base64.name,
  icon: 'binary',
  description: t.tools.base64.description,
  group: 'dev',
  offline: true,
  defaultEnabled: false,
  order: 200,
  component: () => import('./Tool'),
};
export default tool;
