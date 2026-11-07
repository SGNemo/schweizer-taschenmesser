import { extOf, withExt } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'obsidian',
  targets: [{ moduleId: 'notes', importerId: 'file' }],
  extensions: ['md', 'markdown', 'txt', 'zip'],
  detect(files) {
    if (files.some((f) => /(?:^|\/)\.obsidian\//.test(f.name))) return 1;
    const md = files.filter((f) => ['md', 'markdown'].includes(extOf(f.name))).length;
    return md >= 2 ? 0.6 : md === 1 ? 0.4 : 0;
  },
  summarize: (files) => ({
    notes: withExt(files, 'md', 'markdown').filter((f) => !/(?:^|\/)\./.test(f.name)).length,
  }),
};
