import { best, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'enex',
  targets: [{ moduleId: 'notes', importerId: 'file' }],
  extensions: ['enex'],
  detect: (files) =>
    best(files, (f) => (extOf(f.name) === 'enex' ? 1 : /<en-export[\s>]/.test(head(f)) ? 1 : 0)),
};
