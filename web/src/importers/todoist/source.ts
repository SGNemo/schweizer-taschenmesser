import { detectTaskExport } from '@/core/io/taskImport';
import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'todoist',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) =>
    best(files, (f) => (extOf(f.name) === 'csv' && detectTaskExport(f.text) === 'todoist' ? 1 : 0)),
};
