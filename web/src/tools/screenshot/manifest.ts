import { t } from '@/strings';
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
  offline: true,
  // A function for people who use it daily; everyone else keeps the toolbar short.
  defaultEnabled: false,
  order: 170,
  component: () => import('./Tool'),
};
export default tool;
