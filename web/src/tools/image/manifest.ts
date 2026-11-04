import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
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
  category: 'medien',
  identity: { hue: 'fern', hue2: 'lime', signature: 'photoFrame' },
  get keywords() {
    return toolKeywords(t.tools.image.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 150,
  component: () => import('./Tool'),
};
export default tool;
