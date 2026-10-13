import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'pdf',
  get name() {
    return t.tools.pdf.name;
  },
  icon: 'files',
  get description() {
    return t.tools.pdf.description;
  },
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 160,
  component: () => import('./Tool'),
};
export default tool;
