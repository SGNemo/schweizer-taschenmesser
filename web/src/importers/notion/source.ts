import { best, withExt } from '../helpers';
import type { SourceDef } from '../types';
import { isNotionPath } from './parse';

export const source: SourceDef = {
  id: 'notion',
  targets: [{ moduleId: 'notes', importerId: 'file' }],
  extensions: ['zip', 'md', 'csv'],
  // `Title <32 hex>.md` is Notion's own naming; nothing else produces it.
  detect: (files) => best(files, (f) => (isNotionPath(f.name) ? 1 : 0)),
  summarize: (files) => ({ notes: withExt(files, 'md').length }),
};
