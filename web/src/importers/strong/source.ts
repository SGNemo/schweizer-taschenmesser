import { best, head } from '../helpers';
import type { SourceDef } from '../types';
import { looksLikeStrong } from './parse';

export const source: SourceDef = {
  id: 'strong',
  targets: [{ moduleId: 'fitness', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) => best(files, (f) => (looksLikeStrong(head(f, 2000)) ? 1 : 0)),
};
