import type { ModuleManifest } from '@/core/modules/types';
import { plainToMarkdown } from './editor/markdown';

export const migrations: ModuleManifest['migrations'] = {
  // 2: the body is Markdown now (rich-text editor). Old plain text keeps every line (hard breaks).
  2: (ctx) =>
    ctx.forEachRecord('note', (r) => {
      if (typeof r.body !== 'string') return;
      const body = plainToMarkdown(r.body);
      if (body !== r.body) return { body };
    }),
};
