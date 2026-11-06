import { detectTaskExport } from '@/core/io/taskImport';
import { parseTodoistCsv } from '@/core/io/todoistCsv';
import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'todoist',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) =>
    best(files, (f) => (extOf(f.name) === 'csv' && detectTaskExport(f.text) === 'todoist' ? 1 : 0)),
  // One CSV per project.
  summarize: (files) => ({
    projects: files.length,
    tasks: files.reduce((n, f) => n + parseTodoistCsv(f.text, { listName: '' }).tasks.length, 0),
  }),
};
