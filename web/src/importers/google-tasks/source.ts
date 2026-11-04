import { best, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'google-tasks',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['json'],
  detect: (files) =>
    best(files, (f) =>
      extOf(f.name) === 'json' && /"kind"\s*:\s*"tasks#/.test(head(f, 4000)) ? 1 : 0,
    ),
};
