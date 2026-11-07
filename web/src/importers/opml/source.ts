import { best, countAll, extOf, head } from '../helpers';
import type { SourceDef } from '../types';
import { looksLikeOpml } from './parse';

export const source: SourceDef = {
  id: 'opml',
  targets: [{ moduleId: 'feeds', importerId: 'file' }],
  extensions: ['opml', 'xml'],
  detect: (files) =>
    best(files, (f) => (looksLikeOpml(head(f, 4000)) ? 1 : extOf(f.name) === 'opml' ? 0.6 : 0)),
  summarize: (files) => ({ feeds: countAll(files, /xmlUrl\s*=/gi) }),
};
