import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'regex',
  get name() {
    return t.tools.regex.name;
  },
  icon: 'braces',
  get description() {
    return t.tools.regex.description;
  },
  group: 'dev',
  category: 'entwickler',
  identity: { hue: 'lime', signature: 'pattern', type: 'mono' },
  get keywords() {
    return toolKeywords(t.tools.regex.keywords);
  },
  offline: true,
  // A helper for few people; everyone else keeps the toolbar short.
  defaultEnabled: false,
  maturity: 'preview',
  order: 220,
  component: () => import('./Tool'),
};
export default tool;
