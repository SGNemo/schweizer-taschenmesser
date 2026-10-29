import { t } from '@/strings';
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
  offline: true,
  // A helper for few people; everyone else keeps the toolbar short.
  defaultEnabled: false,
  order: 220,
  component: () => import('./Tool'),
};
export default tool;
