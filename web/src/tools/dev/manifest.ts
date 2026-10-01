import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dev',
  name: t.tools.dev.name,
  icon: 'braces',
  description: t.tools.dev.description,
  group: 'dev',
  offline: true,
  defaultEnabled: false,
  order: 200,
  component: () => import('./Tool'),
};
export default tool;
