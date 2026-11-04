import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dice',
  get name() {
    return t.tools.dice.name;
  },
  icon: 'dice',
  get description() {
    return t.tools.dice.description;
  },
  group: 'extra',
  category: 'erzeugen',
  identity: { hue: 'orchid', hue2: 'violet', signature: 'dice' },
  get keywords() {
    return toolKeywords(t.tools.dice.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 130,
  component: () => import('./Tool'),
};
export default tool;
