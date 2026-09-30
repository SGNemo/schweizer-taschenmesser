import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'json',
  name: t.tools.json.name,
  icon: 'braces',
  description: t.tools.json.description,
  group: 'dev',
  offline: true,
  defaultEnabled: false,
  order: 210,
  component: () => import('./Tool'),
};
export default tool;
