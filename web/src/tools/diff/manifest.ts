import { t } from '@/strings';
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
  offline: true,
  // A helper for few people; everyone else keeps the toolbar short.
  defaultEnabled: false,
  order: 210,
  component: () => import('./Tool'),
};
export default tool;
