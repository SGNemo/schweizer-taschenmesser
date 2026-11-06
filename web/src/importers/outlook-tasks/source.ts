import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';
import { isOutlookTasksCsv, parseOutlookTasks } from './parse';

export const source: SourceDef = {
  id: 'outlook-tasks',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) =>
    best(files, (f) => (extOf(f.name) === 'csv' && isOutlookTasksCsv(f.text) ? 0.9 : 0)),
  summarize: (files) => ({
    tasks: files.reduce((n, f) => n + parseOutlookTasks(f.text, { listName: '' }).tasks.length, 0),
  }),
};
