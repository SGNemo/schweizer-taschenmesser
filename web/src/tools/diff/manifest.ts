import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'diff',
  get name() {
    return t.tools.diff.name;
  },
  icon: 'files',
  get description() {
    return t.tools.diff.description;
  },
  group: 'dev',
  category: 'entwickler',
  identity: { hue: 'teal', signature: 'splitPage', type: 'mono' },
  get keywords() {
    return toolKeywords(t.tools.diff.keywords);
  },
  offline: true,
  // A helper for few people; everyone else keeps the toolbar short.
  defaultEnabled: false,
  maturity: 'preview',
  order: 210,
  component: () => import('./Tool'),
};
export default tool;
