import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'image',
  get name() {
    return t.tools.image.name;
  },
  icon: 'image',
  get description() {
    return t.tools.image.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 150,
  component: () => import('./Tool'),
};
export default tool;
