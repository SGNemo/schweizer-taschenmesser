import { t } from '@/strings';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'qr',
  name: t.tools.qr.name,
  icon: 'qr',
  description: t.tools.qr.description,
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  order: 50,
  component: () => import('./Tool'),
};
export default tool;
