import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'calc',
  name: t.tools.calc.name,
  icon: 'calculator',
  description: t.tools.calc.description,
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 10,
  component: () => import('./Tool'),
};
export default tool;
