import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'screenshot',
  get name() {
    return t.tools.screenshot.name;
  },
  icon: 'monitor',
  get description() {
    return t.tools.screenshot.description;
  },
  group: 'extra',
  category: 'medien',
  identity: { hue: 'sky', hue2: 'cobalt', signature: 'viewfinder' },
  get keywords() {
    return toolKeywords(t.tools.screenshot.keywords);
  },
  offline: true,
  // A function for people who use it daily; everyone else keeps the toolbar short.
  defaultEnabled: false,
  maturity: 'preview',
  order: 170,
  component: () => import('./Tool'),
};
export default tool;
