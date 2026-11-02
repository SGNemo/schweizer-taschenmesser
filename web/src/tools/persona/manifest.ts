import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'persona',
  get name() {
    return t.tools.persona.name;
  },
  icon: 'users',
  get description() {
    return t.tools.persona.description;
  },
  group: 'extra',
  offline: true,
  // For sign-ups and tests only; everyone else keeps the toolbar short. Switched on in the tool library.
  defaultEnabled: false,
  maturity: 'stable',
  order: 190,
  component: () => import('./Tool'),
};
export default tool;
