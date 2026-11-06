import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';
import { isTickTickCsv, summarizeTickTick } from './parse';

export const source: SourceDef = {
  id: 'ticktick',
  targets: [{ moduleId: 'todos', importerId: 'file' }],
  extensions: ['csv'],
  detect: (files) => best(files, (f) => (extOf(f.name) === 'csv' && isTickTickCsv(f.text) ? 1 : 0)),
  summarize(files) {
    let lists = 0;
    let tasks = 0;
    for (const f of files) {
      const s = summarizeTickTick(f.text);
      lists += s.lists;
      tasks += s.tasks;
    }
    return { lists, tasks };
  },
};
