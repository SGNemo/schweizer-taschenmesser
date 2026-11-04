import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'timezones',
  get name() {
    return t.tools.timezones.name;
  },
  icon: 'globe',
  get description() {
    return t.tools.timezones.description;
  },
  group: 'extra',
  category: 'zeit',
  identity: { hue: 'ocean', hue2: 'teal', signature: 'globe' },
  get keywords() {
    return toolKeywords(t.tools.timezones.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 125,
  component: () => import('./Tool'),
};
export default tool;
