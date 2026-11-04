import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
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
  category: 'medien',
  identity: { hue: 'indigo', hue2: 'violet', signature: 'pageStack' },
  get keywords() {
    return toolKeywords(t.tools.pdf.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 160,
  component: () => import('./Tool'),
};
export default tool;
