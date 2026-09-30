import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'pdf',
  name: t.tools.pdf.name,
  icon: 'files',
  description: t.tools.pdf.description,
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  order: 160,
  component: () => import('./Tool'),
};
export default tool;
