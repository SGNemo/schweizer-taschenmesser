import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'calc',
  get name() {
    return t.tools.calc.name;
  },
  icon: 'calculator',
  get description() {
    return t.tools.calc.description;
  },
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 10,
  component: () => import('./Tool'),
};
export default tool;
