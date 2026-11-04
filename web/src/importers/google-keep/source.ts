import { best, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'google-keep',
  targets: [{ moduleId: 'notes', importerId: 'file' }],
  extensions: ['json'],
  detect: (files) =>
    best(files, (f) => {
      if (extOf(f.name) !== 'json') return 0;
      if (/(?:^|\/)Keep\/[^/]+\.json$/i.test(f.name)) return 1;
      return /"(?:textContent|listContent)"\s*:/.test(head(f, 4000)) &&
        /"(?:isTrashed|isPinned|isArchived)"\s*:/.test(head(f, 4000))
        ? 0.9
        : 0;
    }),
};
