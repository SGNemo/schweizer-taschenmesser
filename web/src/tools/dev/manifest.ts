import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'dev',
  get name() {
    return t.tools.dev.name;
  },
  icon: 'braces',
  get description() {
    return t.tools.dev.description;
  },
  group: 'dev',
  category: 'entwickler',
  identity: { hue: 'slate', signature: 'terminal', type: 'mono' },
  get keywords() {
    return toolKeywords(t.tools.dev.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 200,
  component: () => import('./Tool'),
};
export default tool;
