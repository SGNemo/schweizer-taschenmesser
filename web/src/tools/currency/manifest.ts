import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'currency',
  get name() {
    return t.tools.currency.name;
  },
  icon: 'coins',
  get description() {
    return t.tools.currency.description;
  },
  group: 'basis',
  offline: false,
  defaultEnabled: true,
  order: 30,
  component: () => import('./Tool'),
};
export default tool;
