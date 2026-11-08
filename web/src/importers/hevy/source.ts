import { best, head } from '../helpers';
import type { SourceDef } from '../types';
import { looksLikeHevy } from './parse';

export const source: SourceDef = {
  id: 'hevy',
  targets: [{ moduleId: 'fitness', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) => best(files, (f) => (looksLikeHevy(head(f, 2000)) ? 1 : 0)),
};
