import { parseGoogleTasks } from '@/core/io/googleTasks';
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
  summarize(files) {
    const tasks = files.flatMap((f) => parseGoogleTasks(f.text, { listName: '' }).tasks);
    return { lists: new Set(tasks.map((t) => t.list)).size, tasks: tasks.length };
  },
};
