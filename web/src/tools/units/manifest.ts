import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';
import { convertQuery } from './expression';

const tool: ToolManifest = {
  id: 'units',
  get name() {
    return t.tools.units.name;
  },
  icon: 'ruler',
  get description() {
    return t.tools.units.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 100,
  component: () => import('./Tool'),
  expression(query) {
    return convertQuery(query);
  },
};
export default tool;
