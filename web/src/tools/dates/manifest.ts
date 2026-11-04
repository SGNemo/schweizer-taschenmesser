import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dates',
  get name() {
    return t.tools.dates.name;
  },
  icon: 'calendarDays',
  get description() {
    return t.tools.dates.description;
  },
  group: 'extra',
  category: 'zeit',
  identity: { hue: 'sky', hue2: 'ocean', signature: 'calendarLeaf' },
  get keywords() {
    return toolKeywords(t.tools.dates.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 120,
  component: () => import('./Tool'),
};
export default tool;
