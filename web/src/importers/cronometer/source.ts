import { best, head } from '../helpers';
import type { SourceDef } from '../types';
import { looksLikeCronometer } from './parse';

export const source: SourceDef = {
  id: 'cronometer',
  targets: [{ moduleId: 'fitness', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) => best(files, (f) => (looksLikeCronometer(head(f, 2000)) ? 1 : 0)),
};
