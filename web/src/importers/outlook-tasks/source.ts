import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';
import { isOutlookTasksCsv } from './parse';

export const source: SourceDef = {
  id: 'outlook-tasks',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) =>
    best(files, (f) => (extOf(f.name) === 'csv' && isOutlookTasksCsv(f.text) ? 0.9 : 0)),
};
