import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'qr',
  get name() {
    return t.tools.qr.name;
  },
  icon: 'qr',
  get description() {
    return t.tools.qr.description;
  },
  group: 'basis',
  category: 'erzeugen',
  identity: { hue: 'indigo', hue2: 'cobalt', signature: 'qrFrame' },
  get keywords() {
    return toolKeywords(t.tools.qr.keywords);
  },
  offline: true,
  defaultEnabled: true,
  maturity: 'stable',
  order: 50,
  component: () => import('./Tool'),
};
export default tool;
