import { t } from '@/strings';
import { toolKeywords } from '@/core/tools/keywords';
import type { ToolManifest } from '@/core/tools/types';

const tool: ToolManifest = {
  id: 'text',
  get name() {
    return t.tools.text.name;
  },
  icon: 'text',
  get description() {
    return t.tools.text.description;
  },
  group: 'extra',
  category: 'text',
  identity: { hue: 'moss', hue2: 'fern', signature: 'notePaper' },
  get keywords() {
    return toolKeywords(t.tools.text.keywords);
  },
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 140,
  component: () => import('./Tool'),
};
export default tool;
