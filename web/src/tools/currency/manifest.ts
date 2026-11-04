import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
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
  category: 'rechnen',
  identity: { hue: 'teal', hue2: 'ocean', signature: 'flow' },
  get keywords() {
    return toolKeywords(t.tools.currency.keywords);
  },
  offline: false,
  defaultEnabled: true,
  maturity: 'stable',
  order: 30,
  component: () => import('./Tool'),
};
export default tool;
