import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'text',
  get name() {
    return t.tools.text.name;
  },
  icon: 'text',
  get description() {
    return t.tools.text.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 140,
  component: () => import('./Tool'),
};
export default tool;
